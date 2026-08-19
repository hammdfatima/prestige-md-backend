import { status as HttpStatus } from "http-status";
import {
  UserRole,
  UserStatus,
  VisitStatus,
  type User,
} from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { HttpError } from "~/middlewares/error-handler";
import type { CreateVisitBody, ListVisitsQuery } from "~/schemas/visit-schemas";
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
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

function publicVisitStatus(status: VisitStatus) {
  return status.toLowerCase() as
    | "in_queue"
    | "in_progress"
    | "completed"
    | "cancelled";
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
  scheduledAt: Date;
  createdAt: Date;
  patient: Parameters<typeof publicPatient>[0];
  provider: User;
  bookedBy: { id: string; firstName: string; lastName: string };
}) {
  return {
    id: visit.id,
    reason: visit.reason,
    status: publicVisitStatus(visit.status),
    service: "Video visit",
    scheduledAt: visit.scheduledAt.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    patient: publicPatient(visit.patient),
    provider: publicProvider(visit.provider),
    bookedBy: {
      id: visit.bookedBy.id,
      name: `${visit.bookedBy.firstName} ${visit.bookedBy.lastName}`.trim(),
    },
  };
}

function assertCanListVisits(auth: TokenPayload) {
  if (auth.role === UserRole.ADMIN || auth.role === UserRole.NURSE || auth.role === UserRole.DOCTOR) {
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

  return publicVisit(visit);
}

export async function listVisits(auth: TokenPayload, query: ListVisitsQuery) {
  assertCanListVisits(auth);

  if (auth.role === UserRole.NURSE && !auth.facilityId) {
    return [];
  }

  if (query.patientId && auth.role === UserRole.NURSE) {
    await getPatientForViewer(auth, query.patientId);
  }

  const where = {
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(auth.role === UserRole.DOCTOR ? { providerId: auth.id } : {}),
    ...(auth.role === UserRole.NURSE && auth.facilityId
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

  const visit = await prisma.visit.findFirst({
    where: { id },
    include: visitInclude,
  });

  if (!visit) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (
    auth.role === UserRole.NURSE &&
    visit.patient.facilityId !== auth.facilityId
  ) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  if (auth.role === UserRole.DOCTOR && visit.providerId !== auth.id) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  return publicVisit(visit);
}
