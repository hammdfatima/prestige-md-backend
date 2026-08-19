import { status as HttpStatus } from "http-status";
import type { PatientMedication } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { HttpError } from "~/middlewares/error-handler";
import type {
  PatientMedicationBody,
  PatientNotesBody,
} from "~/schemas/patient-care-schemas";
import { getPatientForViewer } from "~/services/patient-service";
import type { TokenPayload } from "~/types";

type MedicationRecord = PatientMedication & {
  createdBy: { firstName: string; lastName: string } | null;
};

const medicationInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
} as const;

function publicMedication(medication: MedicationRecord) {
  return {
    id: medication.id,
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    instructions: medication.instructions,
    addedAt: medication.createdAt.toISOString(),
    createdByName: medication.createdBy
      ? `${medication.createdBy.firstName} ${medication.createdBy.lastName}`.trim()
      : null,
  };
}

async function getMedicationOrThrow(patientId: string, medicationId: string) {
  const medication = await prisma.patientMedication.findFirst({
    where: { id: medicationId, patientId },
    include: medicationInclude,
  });

  if (!medication) {
    throw new HttpError("Medication not found", HttpStatus.NOT_FOUND);
  }

  return medication;
}

export async function listMedications(auth: TokenPayload, patientId: string) {
  await getPatientForViewer(auth, patientId);

  const medications = await prisma.patientMedication.findMany({
    where: { patientId },
    include: medicationInclude,
    orderBy: { createdAt: "desc" },
  });

  return medications.map(publicMedication);
}

export async function createMedication(
  auth: TokenPayload,
  patientId: string,
  input: PatientMedicationBody,
) {
  await getPatientForViewer(auth, patientId);

  const medication = await prisma.patientMedication.create({
    data: {
      patientId,
      createdByUserId: auth.id,
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      frequency: input.frequency.trim(),
      instructions: input.instructions.trim(),
    },
    include: medicationInclude,
  });

  return publicMedication(medication);
}

export async function updateMedication(
  auth: TokenPayload,
  patientId: string,
  medicationId: string,
  input: PatientMedicationBody,
) {
  await getPatientForViewer(auth, patientId);
  await getMedicationOrThrow(patientId, medicationId);

  const medication = await prisma.patientMedication.update({
    where: { id: medicationId },
    data: {
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      frequency: input.frequency.trim(),
      instructions: input.instructions.trim(),
    },
    include: medicationInclude,
  });

  return publicMedication(medication);
}

export async function deleteMedication(
  auth: TokenPayload,
  patientId: string,
  medicationId: string,
) {
  await getPatientForViewer(auth, patientId);
  await getMedicationOrThrow(patientId, medicationId);
  await prisma.patientMedication.delete({ where: { id: medicationId } });
  return { id: medicationId };
}

export async function getNotes(auth: TokenPayload, patientId: string) {
  const patient = await getPatientForViewer(auth, patientId);
  return { notes: patient.nurseNotes };
}

export async function updateNotes(
  auth: TokenPayload,
  patientId: string,
  input: PatientNotesBody,
) {
  await getPatientForViewer(auth, patientId);

  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: { nurseNotes: input.notes },
  });

  return { notes: patient.nurseNotes };
}
