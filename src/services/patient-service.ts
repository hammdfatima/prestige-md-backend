import { randomBytes } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, type Patient } from "~/generated/prisma/client";
import { hasTeamPermission } from "~/lib/permissions";
import prisma from "~/lib/db";
import { patientInclude } from "~/lib/patient-include";
import { assertOptionalCallerOwnsObjectKey } from "~/lib/object-key-ownership";
import { recordMatchesSearch } from "~/lib/encrypted-search";
import { patientEmailWhere } from "~/lib/encryption-queries";
import { HttpError } from "~/middlewares/error-handler";
import type {
  CreatePatientBody,
  ListPatientsQuery,
} from "~/schemas/patient-schemas";
import {
  getPatientRecordForFacilityStaff,
  getPatientRecordForProvider,
  listPatientIdsForProvider,
} from "~/services/care-relationship";
import { assertStepUpToken } from "~/services/step-up-auth-service";
import type { TokenPayload } from "~/types";

type PatientRecord = Patient & {
  facility: { id: string; name: string };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  deletionRequestedAt?: Date | null;
  anonymizedAt?: Date | null;
};

export { patientInclude } from "~/lib/patient-include";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError("Enter a valid date", HttpStatus.BAD_REQUEST);
  }
  return parsed;
}

function generateMemberId() {
  return `PT-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function getFacilityOrThrow(facilityId: string) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });

  if (!facility) {
    throw new HttpError("Facility not found", HttpStatus.NOT_FOUND);
  }

  if (facility.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Cannot assign a patient to an inactive facility",
      HttpStatus.BAD_REQUEST,
    );
  }

  return facility;
}

function toPatientWriteData(input: CreatePatientBody, auth: TokenPayload) {
  const { firstName, lastName } = splitName(input.name);
  const avatarUrl = input.avatarUrl.trim();

  if (!/^https?:\/\//i.test(avatarUrl)) {
    throw new HttpError(
      "avatarUrl must be a Cloudinary HTTPS URL",
      HttpStatus.BAD_REQUEST,
    );
  }

  assertOptionalCallerOwnsObjectKey(auth, input.avatarPublicId);

  parseDateOnly(input.dateOfBirth);
  parseDateOnly(input.insuranceEffectiveDate);
  parseDateOnly(input.examinationDate);

  return {
    firstName,
    lastName,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth,
    avatarUrl,
    avatarPublicId: input.avatarPublicId?.trim() || null,
    authorizedRepresentative: input.authorizedRepresentative?.trim() || null,
    decisionMaker: input.decisionMaker.trim(),
    nextOfKinName: input.nextOfKinName.trim(),
    nextOfKinRelationship: input.nextOfKinRelationship.trim(),
    nextOfKinPhone: input.nextOfKinPhone.trim(),
    nextOfKinEmail: input.nextOfKinEmail.trim().toLowerCase(),
    nextOfKinAddress: input.nextOfKinAddress.trim(),
    insuranceProvider: input.insuranceProvider.trim(),
    insurancePlanName: input.insurancePlanName.trim(),
    insurancePlanType: input.insurancePlanType.trim(),
    insuranceMemberId: input.insuranceMemberId.trim(),
    insuranceGroupNumber: input.insuranceGroupNumber.trim(),
    insuranceSubscriberName: input.insuranceSubscriberName.trim(),
    insuranceSubscriberRelationship:
      input.insuranceSubscriberRelationship.trim(),
    insuranceEffectiveDate: input.insuranceEffectiveDate,
    insurancePhone: input.insurancePhone.trim(),
    knownAllergies: input.knownAllergies.trim(),
    medicalHistory: input.medicalHistory.trim(),
    height: input.height.trim(),
    weight: input.weight.trim(),
    physicalOrSensoryLimitations: input.physicalOrSensoryLimitations.trim(),
    cognitiveOrBehavioralStatus: input.cognitiveOrBehavioralStatus.trim(),
    nursingTreatmentRequirements: input.nursingTreatmentRequirements.trim(),
    specialPrecautions: input.specialPrecautions.trim(),
    elopementRisk: input.elopementRisk,
    ambulation: input.ambulation,
    bathing: input.bathing,
    dressing: input.dressing,
    eating: input.eating,
    selfCare: input.selfCare,
    toileting: input.toileting,
    transferring: input.transferring,
    specialDiet: input.specialDiet,
    specialDietOther: input.specialDietOther?.trim() || null,
    communicableDisease: input.communicableDisease,
    bedridden: input.bedridden,
    pressureSores: input.pressureSores,
    dangerToSelfOrOthers: input.dangerToSelfOrOthers,
    require24HourCare: input.require24HourCare,
    needsMetInAlf: input.needsMetInAlf,
    currentMedications: input.currentMedications.trim(),
    needsHelpWithMedications: input.needsHelpWithMedications,
    medicationAssistance: input.medicationAssistance || null,
    additionalComments: input.additionalComments?.trim() || null,
    examinerName: input.examinerName.trim(),
    examinerLicenseNumber: input.examinerLicenseNumber.trim(),
    examinerTitle: input.examinerTitle,
    examinerPhone: input.examinerPhone.trim(),
    examinerAddress: input.examinerAddress.trim(),
    examinationDate: input.examinationDate,
  };
}

export function publicPatient(patient: PatientRecord) {
  return {
    id: patient.id,
    memberId: patient.memberId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: `${patient.firstName} ${patient.lastName}`.trim(),
    email: patient.email,
    phone: patient.phone,
    dateOfBirth: patient.dateOfBirth,
    avatarUrl: patient.avatarUrl,
    avatarPublicId: patient.avatarPublicId,
    authorizedRepresentative: patient.authorizedRepresentative,
    decisionMaker: patient.decisionMaker,
    nextOfKin: {
      name: patient.nextOfKinName,
      relationship: patient.nextOfKinRelationship,
      phone: patient.nextOfKinPhone,
      email: patient.nextOfKinEmail,
      address: patient.nextOfKinAddress,
    },
    insurance: {
      provider: patient.insuranceProvider,
      planName: patient.insurancePlanName,
      planType: patient.insurancePlanType,
      memberId: patient.insuranceMemberId,
      groupNumber: patient.insuranceGroupNumber,
      subscriberName: patient.insuranceSubscriberName,
      subscriberRelationship: patient.insuranceSubscriberRelationship,
      effectiveDate: patient.insuranceEffectiveDate,
      phone: patient.insurancePhone,
    },
    facilityId: patient.facilityId,
    facilityName: patient.facility.name,
    createdBy: patient.createdBy
      ? {
          id: patient.createdBy.id,
          name: `${patient.createdBy.firstName} ${patient.createdBy.lastName}`.trim(),
          avatarUrl: patient.createdBy.avatarUrl,
        }
      : null,
    status: patient.status,
    knownAllergies: patient.knownAllergies,
    medicalHistory: patient.medicalHistory,
    height: patient.height,
    weight: patient.weight,
    physicalOrSensoryLimitations: patient.physicalOrSensoryLimitations,
    cognitiveOrBehavioralStatus: patient.cognitiveOrBehavioralStatus,
    nursingTreatmentRequirements: patient.nursingTreatmentRequirements,
    specialPrecautions: patient.specialPrecautions,
    elopementRisk: patient.elopementRisk,
    ambulation: patient.ambulation,
    bathing: patient.bathing,
    dressing: patient.dressing,
    eating: patient.eating,
    selfCare: patient.selfCare,
    toileting: patient.toileting,
    transferring: patient.transferring,
    specialDiet: patient.specialDiet,
    specialDietOther: patient.specialDietOther,
    communicableDisease: patient.communicableDisease,
    bedridden: patient.bedridden,
    pressureSores: patient.pressureSores,
    dangerToSelfOrOthers: patient.dangerToSelfOrOthers,
    require24HourCare: patient.require24HourCare,
    needsMetInAlf: patient.needsMetInAlf,
    currentMedications: patient.currentMedications,
    needsHelpWithMedications: patient.needsHelpWithMedications,
    medicationAssistance: patient.medicationAssistance,
    additionalComments: patient.additionalComments,
    examinerName: patient.examinerName,
    examinerLicenseNumber: patient.examinerLicenseNumber,
    examinerTitle: patient.examinerTitle,
    examinerPhone: patient.examinerPhone,
    examinerAddress: patient.examinerAddress,
    examinationDate: patient.examinationDate,
    nurseNotes: patient.nurseNotes,
    deletionRequestedAt: patient.deletionRequestedAt?.toISOString() ?? null,
    anonymizedAt: patient.anonymizedAt?.toISOString() ?? null,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

export async function createPatient(
  input: CreatePatientBody,
  auth: TokenPayload,
) {
  const writeData = toPatientWriteData(input, auth);
  const facility = await getFacilityOrThrow(input.facilityId);

  if (writeData.email) {
    const existing = await prisma.patient.findFirst({
      where: patientEmailWhere(writeData.email),
    });
    if (existing) {
      throw new HttpError(
        "A patient with this email already exists",
        HttpStatus.CONFLICT,
      );
    }
  }

  const creator = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true },
  });
  const createdBy = creator ? { connect: { id: creator.id } } : undefined;

  let patient: PatientRecord | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      patient = await prisma.patient.create({
        data: {
          ...writeData,
          memberId: generateMemberId(),
          status: UserStatus.ACTIVE,
          facility: { connect: { id: facility.id } },
          ...(createdBy ? { createdBy } : {}),
        },
        include: patientInclude,
      });
      break;
    } catch (error) {
      const isUnique =
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isUnique || attempt === 4) {
        throw error;
      }
    }
  }

  if (!patient) {
    throw new HttpError("Could not create patient", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  return publicPatient(patient);
}

export async function listPatients(query: ListPatientsQuery) {
  const search = query.search?.trim();

  const patients = await prisma.patient.findMany({
    where: {
      status: query.status,
      facilityId: query.facilityId,
    },
    include: patientInclude,
    orderBy: { createdAt: "desc" },
  });

  const filtered = search
    ? patients.filter((patient) =>
        recordMatchesSearch(patient, search, [
          "firstName",
          "lastName",
          "email",
          "phone",
          "memberId",
        ]),
      )
    : patients;

  return filtered.map(publicPatient);
}

export async function getPatient(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: patientInclude,
  });

  if (!patient) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  return publicPatient(patient);
}

/** Admin/staff patient lookup — not for clinical roles; use getPatientForViewer instead. */
async function getPatientRecord(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: patientInclude,
  });

  if (!patient) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  return patient;
}

function assertCanReadPatients(auth: TokenPayload) {
  if (
    auth.role === UserRole.ADMIN ||
    auth.role === UserRole.NURSE ||
    auth.role === UserRole.FACILITY_MANAGER ||
    auth.role === UserRole.DOCTOR
  ) {
    return;
  }

  if (hasTeamPermission(auth, "manage_patients")) {
    return;
  }

  throw new HttpError(
    "You do not have access to this resource",
    HttpStatus.FORBIDDEN,
  );
}

function isFacilityScopedReader(auth: TokenPayload) {
  return (
    auth.role === UserRole.NURSE || auth.role === UserRole.FACILITY_MANAGER
  );
}

export async function listPatientsForViewer(
  auth: TokenPayload,
  query: ListPatientsQuery,
) {
  assertCanReadPatients(auth);

  if (auth.role === UserRole.DOCTOR) {
    const patientIds = await listPatientIdsForProvider(auth.id);
    if (patientIds.length === 0) {
      return [];
    }

    const search = query.search?.trim();

    const patients = await prisma.patient.findMany({
      where: {
        id: { in: patientIds },
        ...(query.status ? { status: query.status } : {}),
      },
      include: patientInclude,
      orderBy: { updatedAt: "desc" },
    });

    const filtered = search
      ? patients.filter((patient) =>
          recordMatchesSearch(patient, search, [
            "firstName",
            "lastName",
            "memberId",
            "email",
          ]),
        )
      : patients;

    return filtered.map((patient) => publicPatient(patient));
  }

  if (isFacilityScopedReader(auth)) {
    if (!auth.facilityId) {
      return [];
    }
    return listPatients({ ...query, facilityId: auth.facilityId });
  }

  return listPatients(query);
}

export async function getPatientForViewer(auth: TokenPayload, id: string) {
  assertCanReadPatients(auth);

  if (auth.role === UserRole.DOCTOR) {
    const patient = await getPatientRecordForProvider(auth.id, id);
    return publicPatient(patient);
  }

  if (isFacilityScopedReader(auth)) {
    if (!auth.facilityId) {
      throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
    }
    const patient = await getPatientRecordForFacilityStaff(
      auth.facilityId,
      id,
    );
    return publicPatient(patient);
  }

  const patient = await getPatientRecord(id);
  return publicPatient(patient);
}

/** §16.2 object-level check — throws 404 when patient is out of scope. */
export async function assertPatientAccessForViewer(
  auth: TokenPayload,
  patientId: string,
) {
  await getPatientForViewer(auth, patientId);
}

export async function updatePatient(
  id: string,
  input: CreatePatientBody,
  auth: TokenPayload,
) {
  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  const writeData = toPatientWriteData(input, auth);
  const facility = await getFacilityOrThrow(input.facilityId);

  if (writeData.email) {
    const duplicate = await prisma.patient.findFirst({
      where: {
        ...patientEmailWhere(writeData.email),
        NOT: { id },
      },
    });
    if (duplicate) {
      throw new HttpError(
        "A patient with this email already exists",
        HttpStatus.CONFLICT,
      );
    }
  }

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...writeData,
      facility: { connect: { id: facility.id } },
    },
    include: patientInclude,
  });

  return publicPatient(patient);
}

/** HIPAA §6.2 staged patient deletion — admin request; retention job anonymizes then purges. */
export async function requestPatientDeletion(
  auth: TokenPayload,
  id: string,
  stepUpToken: string,
) {
  assertStepUpToken(auth, stepUpToken);

  const existing = await prisma.patient.findUnique({
    where: { id },
    select: {
      id: true,
      deletionRequestedAt: true,
      anonymizedAt: true,
    },
  });

  if (!existing) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  if (existing.deletionRequestedAt) {
    throw new HttpError(
      "A deletion request is already on file for this patient",
      HttpStatus.CONFLICT,
    );
  }

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      deletionRequestedAt: new Date(),
      deletionRequestedByUserId: auth.id,
      status: UserStatus.INACTIVE,
    },
    include: patientInclude,
  });

  return publicPatient(patient);
}

export async function exportPatientsForViewer(
  auth: TokenPayload,
  stepUpToken: string,
) {
  assertStepUpToken(auth, stepUpToken);
  assertCanReadPatients(auth);

  const patients = await listPatientsForViewer(auth, {});
  return patients.map((patient) => ({
    id: patient.id,
    memberId: patient.memberId,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    facilityName: patient.facilityName,
    status: patient.status,
  }));
}
