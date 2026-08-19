import { randomBytes } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, type Patient } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { HttpError } from "~/middlewares/error-handler";
import type {
  CreatePatientBody,
  ListPatientsQuery,
} from "~/schemas/patient-schemas";
import type { TokenPayload } from "~/types";

type PatientRecord = Patient & {
  facility: { id: string; name: string };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
};

const patientInclude = {
  facility: { select: { id: true, name: true } },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} as const;

export { patientInclude };

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
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

function toPatientWriteData(input: CreatePatientBody) {
  const { firstName, lastName } = splitName(input.name);
  const avatarUrl = input.avatarUrl.trim();

  if (!/^https?:\/\//i.test(avatarUrl)) {
    throw new HttpError(
      "avatarUrl must be a Cloudinary HTTPS URL",
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    firstName,
    lastName,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone.trim(),
    dateOfBirth: parseDateOnly(input.dateOfBirth),
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
    insuranceEffectiveDate: parseDateOnly(input.insuranceEffectiveDate),
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
    examinationDate: parseDateOnly(input.examinationDate),
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
    dateOfBirth: dateOnly(patient.dateOfBirth),
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
      effectiveDate: dateOnly(patient.insuranceEffectiveDate),
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
    examinationDate: dateOnly(patient.examinationDate),
    nurseNotes: patient.nurseNotes,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

export async function createPatient(
  input: CreatePatientBody,
  createdByUserId?: string,
) {
  const writeData = toPatientWriteData(input);
  const facility = await getFacilityOrThrow(input.facilityId);

  if (writeData.email) {
    const existing = await prisma.patient.findFirst({
      where: { email: writeData.email },
    });
    if (existing) {
      throw new HttpError(
        "A patient with this email already exists",
        HttpStatus.CONFLICT,
      );
    }
  }

  let createdBy: { connect: { id: string } } | undefined;
  if (createdByUserId) {
    const creator = await prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { id: true },
    });
    if (creator) {
      createdBy = { connect: { id: creator.id } };
    }
  }

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
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { memberId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: patientInclude,
    orderBy: { createdAt: "desc" },
  });

  return patients.map(publicPatient);
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

function assertCanReadPatients(auth: TokenPayload) {
  if (
    auth.role === UserRole.ADMIN ||
    auth.role === UserRole.NURSE ||
    auth.role === UserRole.FACILITY_MANAGER
  ) {
    return;
  }

  if (
    auth.role === UserRole.TEAM_MEMBER &&
    (auth.permissions ?? []).includes("manage_patients")
  ) {
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
  const patient = await getPatient(id);

  if (
    isFacilityScopedReader(auth) &&
    patient.facilityId !== auth.facilityId
  ) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  return patient;
}

export async function updatePatient(id: string, input: CreatePatientBody) {
  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  const writeData = toPatientWriteData(input);
  const facility = await getFacilityOrThrow(input.facilityId);

  if (writeData.email) {
    const duplicate = await prisma.patient.findFirst({
      where: { email: writeData.email, NOT: { id } },
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

export async function deletePatient(id: string) {
  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  await prisma.patient.delete({ where: { id } });
  return { id };
}
