import { status as HttpStatus } from "http-status";
import {
  UserRole,
  UserStatus,
  VisitStatus,
  type User,
} from "~/generated/prisma/client";
import { buildVisitRtcToken, agoraUidFromUserId } from "~/lib/agora";
import {
  notifyVisitBooked,
  notifyVisitStatus,
  type VisitEmailPayload,
} from "~/lib/emails/visit-notifications";
import prisma from "~/lib/db";
import { HttpError } from "~/middlewares/error-handler";
import type {
  CreateVisitBody,
  ListVisitsQuery,
  UpdateVisitNotesBody,
} from "~/schemas/visit-schemas";
import {
  getPatientForViewer,
  patientInclude,
  publicPatient,
} from "~/services/patient-service";
import type { TokenPayload } from "~/types";

const visitInclude = {
  patient: { include: patientInclude },
  provider: true,
  bookedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      email: true,
      phone: true,
      employeeId: true,
    },
  },
} as const;

function toVisitEmailPayload(visit: {
  id: string;
  reason: string;
  scheduledAt: Date;
  status: VisitStatus;
  patient: { firstName: string; lastName: string; facilityId: string };
  provider: User;
  bookedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}): VisitEmailPayload {
  return {
    id: visit.id,
    reason: visit.reason,
    scheduledAt: visit.scheduledAt,
    status: visit.status,
    facilityId: visit.patient.facilityId,
    patient: {
      firstName: visit.patient.firstName,
      lastName: visit.patient.lastName,
    },
    provider: {
      id: visit.provider.id,
      firstName: visit.provider.firstName,
      lastName: visit.provider.lastName,
      email: visit.provider.email,
    },
    bookedBy: visit.bookedBy,
  };
}

function publicVisitStatus(status: VisitStatus) {
  return status.toLowerCase() as
    | "in_queue"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "missed";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Open visits whose scheduled calendar day has passed become missed. */
async function markPastOpenVisitsMissed() {
  const pastVisits = await prisma.visit.findMany({
    where: {
      status: { in: [VisitStatus.IN_QUEUE, VisitStatus.IN_PROGRESS] },
      scheduledAt: { lt: startOfToday() },
    },
    include: visitInclude,
  });

  if (pastVisits.length === 0) {
    return;
  }

  await prisma.visit.updateMany({
    where: { id: { in: pastVisits.map((visit) => visit.id) } },
    data: { status: VisitStatus.MISSED },
  });

  for (const visit of pastVisits) {
    void notifyVisitStatus(
      toVisitEmailPayload({ ...visit, status: VisitStatus.MISSED }),
      "missed",
    );
  }
}

function publicProvider(provider: User) {
  return {
    id: provider.id,
    name: `${provider.firstName} ${provider.lastName}`.trim(),
    avatarUrl: provider.avatarUrl,
    specialty: provider.specialty,
    medicalLicense: provider.medicalLicense,
    education: provider.education,
    yearsExperience: provider.yearsExperience,
    primaryLanguage: provider.primaryLanguage,
    availability: provider.availability,
  };
}

function publicVisit(visit: {
  id: string;
  reason: string;
  status: VisitStatus;
  progressNotes: string;
  soapSubjective: string;
  soapObjective: string;
  soapAssessment: string;
  soapPlan: string;
  scheduledAt: Date;
  createdAt: Date;
  patient: Parameters<typeof publicPatient>[0];
  provider: User;
  bookedBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string;
    phone: string | null;
    employeeId: string | null;
  };
}) {
  return {
    id: visit.id,
    reason: visit.reason,
    status: publicVisitStatus(visit.status),
    service: visit.reason.trim() || "Video visit",
    scheduledAt: visit.scheduledAt.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    progressNotes: visit.progressNotes,
    soapNotes: {
      subjective: visit.soapSubjective,
      objective: visit.soapObjective,
      assessment: visit.soapAssessment,
      plan: visit.soapPlan,
    },
    patient: publicPatient(visit.patient),
    provider: publicProvider(visit.provider),
    bookedBy: {
      id: visit.bookedBy.id,
      name: `${visit.bookedBy.firstName} ${visit.bookedBy.lastName}`.trim(),
      avatarUrl: visit.bookedBy.avatarUrl,
      email: visit.bookedBy.email,
      phone: visit.bookedBy.phone,
      employeeId: visit.bookedBy.employeeId,
    },
  };
}

function assertCanListVisits(auth: TokenPayload) {
  if (
    auth.role === UserRole.ADMIN ||
    auth.role === UserRole.NURSE ||
    auth.role === UserRole.DOCTOR ||
    auth.role === UserRole.FACILITY_MANAGER
  ) {
    return;
  }

  if (
    auth.role === UserRole.TEAM_MEMBER &&
    (auth.permissions ?? []).includes("manage_appointments")
  ) {
    return;
  }

  throw new HttpError(
    "You do not have access to this resource",
    HttpStatus.FORBIDDEN,
  );
}

export async function createVisit(auth: TokenPayload, input: CreateVisitBody) {
  const patient = await getPatientForViewer(auth, input.patientId);

  const provider = await prisma.user.findFirst({
    where: {
      id: input.providerId,
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
    },
  });

  if (!provider) {
    throw new HttpError("Provider not found", HttpStatus.NOT_FOUND);
  }

  if (!provider.isAvailable) {
    throw new HttpError(
      "This provider is no longer available",
      HttpStatus.BAD_REQUEST,
    );
  }

  const inProgressVisit = await prisma.visit.findFirst({
    where: {
      patientId: patient.id,
      status: VisitStatus.IN_PROGRESS,
    },
    select: { id: true },
  });

  if (inProgressVisit) {
    throw new HttpError(
      "This patient already has a visit in progress. Complete or wait for it to finish before booking another.",
      HttpStatus.CONFLICT,
    );
  }

  const visit = await prisma.visit.create({
    data: {
      patientId: patient.id,
      providerId: provider.id,
      bookedByUserId: auth.id,
      reason: input.reason.trim(),
      status: VisitStatus.IN_QUEUE,
    },
    include: visitInclude,
  });

  void notifyVisitBooked(toVisitEmailPayload(visit));

  return publicVisit(visit);
}

export async function listVisits(auth: TokenPayload, query: ListVisitsQuery) {
  assertCanListVisits(auth);
  await markPastOpenVisitsMissed();

  if (
    (auth.role === UserRole.NURSE || auth.role === UserRole.FACILITY_MANAGER) &&
    !auth.facilityId
  ) {
    return [];
  }

  if (
    query.patientId &&
    (auth.role === UserRole.NURSE || auth.role === UserRole.FACILITY_MANAGER)
  ) {
    await getPatientForViewer(auth, query.patientId);
  }

  const where = {
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(auth.role === UserRole.DOCTOR ? { providerId: auth.id } : {}),
    ...((auth.role === UserRole.NURSE ||
      auth.role === UserRole.FACILITY_MANAGER) &&
    auth.facilityId
      ? { patient: { facilityId: auth.facilityId } }
      : {}),
  };

  const visits = await prisma.visit.findMany({
    where,
    include: visitInclude,
    orderBy: { scheduledAt: "desc" },
  });

  return visits.map((visit) => publicVisit(visit));
}

export async function getVisit(auth: TokenPayload, id: string) {
  assertCanListVisits(auth);
  await markPastOpenVisitsMissed();

  const visit = await prisma.visit.findFirst({
    where: { id },
    include: visitInclude,
  });

  if (!visit) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (
    (auth.role === UserRole.NURSE ||
      auth.role === UserRole.FACILITY_MANAGER) &&
    visit.patient.facilityId !== auth.facilityId
  ) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (auth.role === UserRole.DOCTOR && visit.providerId !== auth.id) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  return publicVisit(visit);
}

async function getCallVisitOrThrow(auth: TokenPayload, id: string) {
  if (auth.role !== UserRole.DOCTOR && auth.role !== UserRole.NURSE) {
    throw new HttpError(
      "You do not have access to this video visit",
      HttpStatus.FORBIDDEN,
    );
  }

  await markPastOpenVisitsMissed();

  const visit = await prisma.visit.findFirst({
    where: { id },
    include: visitInclude,
  });

  if (!visit) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (auth.role === UserRole.DOCTOR && visit.providerId !== auth.id) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (
    auth.role === UserRole.NURSE &&
    visit.patient.facilityId !== auth.facilityId
  ) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  return visit;
}

export async function joinVisit(auth: TokenPayload, id: string) {
  const visit = await getCallVisitOrThrow(auth, id);

  if (
    visit.status === VisitStatus.COMPLETED ||
    visit.status === VisitStatus.CANCELLED ||
    visit.status === VisitStatus.MISSED
  ) {
    throw new HttpError(
      "This visit can no longer be joined",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (auth.role === UserRole.DOCTOR) {
    const otherInProgress = await prisma.visit.findFirst({
      where: {
        providerId: auth.id,
        status: VisitStatus.IN_PROGRESS,
        id: { not: visit.id },
      },
      select: { id: true },
    });

    if (otherInProgress) {
      throw new HttpError(
        "You already have a visit in progress. Complete it before joining another call.",
        HttpStatus.CONFLICT,
      );
    }
  }

  const activeVisit =
    auth.role === UserRole.DOCTOR && visit.status === VisitStatus.IN_QUEUE
      ? await prisma.visit.update({
          where: { id: visit.id },
          data: { status: VisitStatus.IN_PROGRESS },
          include: visitInclude,
        })
      : visit;

  const staff = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { firstName: true, lastName: true },
  });

  const rtc = buildVisitRtcToken({ visitId: activeVisit.id, userId: auth.id });
  const displayName = staff
    ? `${staff.firstName} ${staff.lastName}`.trim()
    : auth.role === UserRole.DOCTOR
      ? "Doctor"
      : "Nurse";

  const providerName =
    `${activeVisit.provider.firstName} ${activeVisit.provider.lastName}`.trim();
  const nurseName =
    `${activeVisit.bookedBy.firstName} ${activeVisit.bookedBy.lastName}`.trim();

  const participants = [
    {
      uid: agoraUidFromUserId(activeVisit.providerId),
      displayName: providerName || "Doctor",
      role: "DOCTOR" as const,
    },
    {
      uid: agoraUidFromUserId(activeVisit.bookedByUserId),
      displayName: nurseName || "Nurse",
      role: "NURSE" as const,
    },
  ];

  return {
    ...rtc,
    displayName,
    role: auth.role === UserRole.DOCTOR ? ("DOCTOR" as const) : ("NURSE" as const),
    participants,
    visit: publicVisit(activeVisit),
  };
}

export async function leaveVisit(auth: TokenPayload, id: string) {
  await getCallVisitOrThrow(auth, id);
  return { left: true as const };
}

export async function updateVisitNotes(
  auth: TokenPayload,
  id: string,
  input: UpdateVisitNotesBody,
) {
  if (auth.role !== UserRole.DOCTOR) {
    throw new HttpError(
      "Only the assigned doctor can update visit notes",
      HttpStatus.FORBIDDEN,
    );
  }

  const visit = await getCallVisitOrThrow(auth, id);

  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: {
      ...(input.progressNotes !== undefined
        ? { progressNotes: input.progressNotes }
        : {}),
      ...(input.soapNotes
        ? {
            soapSubjective: input.soapNotes.subjective,
            soapObjective: input.soapNotes.objective,
            soapAssessment: input.soapNotes.assessment,
            soapPlan: input.soapNotes.plan,
          }
        : {}),
    },
    include: visitInclude,
  });

  return publicVisit(updated);
}

export async function completeVisit(auth: TokenPayload, id: string) {
  if (auth.role !== UserRole.DOCTOR) {
    throw new HttpError(
      "Only the assigned doctor can mark a visit complete",
      HttpStatus.FORBIDDEN,
    );
  }

  const visit = await getCallVisitOrThrow(auth, id);

  if (visit.status === VisitStatus.COMPLETED) {
    return publicVisit(visit);
  }

  if (
    visit.status === VisitStatus.CANCELLED ||
    visit.status === VisitStatus.MISSED
  ) {
    throw new HttpError(
      "This visit cannot be marked complete",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: { status: VisitStatus.COMPLETED },
    include: visitInclude,
  });

  void notifyVisitStatus(toVisitEmailPayload(updated), "completed");

  return publicVisit(updated);
}

export async function cancelVisit(auth: TokenPayload, id: string) {
  if (auth.role !== UserRole.NURSE) {
    throw new HttpError(
      "Only nurses can cancel visits",
      HttpStatus.FORBIDDEN,
    );
  }

  const visit = await getCallVisitOrThrow(auth, id);

  if (visit.status === VisitStatus.CANCELLED) {
    return publicVisit(visit);
  }

  if (
    visit.status !== VisitStatus.IN_QUEUE &&
    visit.status !== VisitStatus.IN_PROGRESS
  ) {
    throw new HttpError(
      "Only queued or in-progress visits can be cancelled",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: { status: VisitStatus.CANCELLED },
    include: visitInclude,
  });

  void notifyVisitStatus(toVisitEmailPayload(updated), "cancelled");

  return publicVisit(updated);
}
