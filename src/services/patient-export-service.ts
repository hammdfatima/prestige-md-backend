/** HIPAA §6.3 patient chart export — step-up auth required. */
import prisma from "~/lib/db";
import { patientInclude } from "~/lib/patient-include";
import { HttpError } from "~/middlewares/error-handler";
import { publicPatient, assertPatientAccessForViewer } from "~/services/patient-service";
import { assertStepUpToken } from "~/services/step-up-auth-service";
import type { TokenPayload } from "~/types";

const patientExportInclude = {
  ...patientInclude,
  medications: {
    orderBy: { createdAt: "asc" as const },
  },
  visits: {
    orderBy: { scheduledAt: "desc" as const },
    include: {
      messages: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          body: true,
          attachmentUrl: true,
          attachmentPublicId: true,
          attachmentMimeType: true,
          attachmentFilename: true,
          attachmentBytes: true,
          createdAt: true,
          readAt: true,
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      provider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      bookedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  },
} as const;

function publicStaffSummary(user: {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}) {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
  };
}

export async function exportPatientBundle(
  auth: TokenPayload,
  patientId: string,
  stepUpToken: string,
) {
  assertStepUpToken(auth, stepUpToken);
  await assertPatientAccessForViewer(auth, patientId);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: patientExportInclude,
  });

  if (!patient) {
    throw new HttpError("Patient not found", 404);
  }

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: auth.id,
      role: auth.role,
    },
    patient: publicPatient(patient),
    medications: patient.medications.map((medication) => ({
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      instructions: medication.instructions,
      createdAt: medication.createdAt.toISOString(),
      updatedAt: medication.updatedAt.toISOString(),
    })),
    visits: patient.visits.map((visit) => ({
      id: visit.id,
      reason: visit.reason,
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
      progressNotes: visit.progressNotes,
      soapNotes: {
        subjective: visit.soapSubjective,
        objective: visit.soapObjective,
        assessment: visit.soapAssessment,
        plan: visit.soapPlan,
      },
      provider: publicStaffSummary(visit.provider),
      bookedBy: publicStaffSummary(visit.bookedBy),
      messages: visit.messages.map((message) => ({
        id: message.id,
        body: message.body,
        attachment:
          message.attachmentUrl && message.attachmentPublicId
            ? {
                url: message.attachmentUrl,
                publicId: message.attachmentPublicId,
                mimeType: message.attachmentMimeType,
                filename: message.attachmentFilename,
                bytes: message.attachmentBytes,
              }
            : null,
        sender: publicStaffSummary(message.sender),
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
      })),
      createdAt: visit.createdAt.toISOString(),
      updatedAt: visit.updatedAt.toISOString(),
    })),
  };
}
