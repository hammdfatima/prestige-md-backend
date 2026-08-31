import type { Patient } from "~/generated/prisma/client";
import {
  CLINICAL_RETENTION_MS,
  SHORT_LIVED_SECRET_RETENTION_MS,
} from "~/lib/retention-config";

export function getRetentionCutoffDate(now = new Date()) {
  return new Date(now.getTime() - CLINICAL_RETENTION_MS);
}

export function getShortLivedSecretCutoffDate(now = new Date()) {
  return new Date(now.getTime() - SHORT_LIVED_SECRET_RETENTION_MS);
}

export function getPatientRetentionAnchor(
  patient: Pick<Patient, "createdAt" | "updatedAt"> & {
    visits: Array<{ updatedAt: Date }>;
  },
) {
  const anchors = [patient.createdAt, patient.updatedAt];

  for (const visit of patient.visits) {
    anchors.push(visit.updatedAt);
  }

  return new Date(Math.max(...anchors.map((value) => value.getTime())));
}

export function isPatientPastRetention(
  patient: Pick<Patient, "createdAt" | "updatedAt"> & {
    visits: Array<{ updatedAt: Date }>;
  },
  now = new Date(),
) {
  const anchor = getPatientRetentionAnchor(patient);
  return anchor.getTime() <= getRetentionCutoffDate(now).getTime();
}
