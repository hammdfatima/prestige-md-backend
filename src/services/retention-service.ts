/** HIPAA §6.1 / §6.2 retention & staged patient deletion. */
import { UserStatus } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import {
  getShortLivedSecretCutoffDate,
  isPatientPastRetention,
} from "~/lib/patient-retention";
import {
  type RetentionJobMode,
  type RetentionJobReport,
} from "~/lib/retention-config";
import logger from "~/lib/logger";

const REDACTED = "REDACTED";

async function purgeShortLivedSecrets(cutoff: Date, live: boolean) {
  if (!live) {
    const [otps, loginActivities, revokedSessions] = await Promise.all([
      prisma.emailOtp.count({ where: { createdAt: { lt: cutoff } } }),
      prisma.loginActivity.count({ where: { createdAt: { lt: cutoff } } }),
      prisma.accountSession.count({
        where: { revokedAt: { not: null, lt: cutoff } },
      }),
    ]);
    return otps + loginActivities + revokedSessions;
  }

  const [otps, loginActivities, revokedSessions] = await prisma.$transaction([
    prisma.emailOtp.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.loginActivity.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.accountSession.deleteMany({
      where: { revokedAt: { not: null, lt: cutoff } },
    }),
  ]);

  return otps.count + loginActivities.count + revokedSessions.count;
}

export async function anonymizePatientRecord(patientId: string) {
  await prisma.patient.update({
    where: { id: patientId },
    data: {
      status: UserStatus.INACTIVE,
      firstName: REDACTED,
      lastName: REDACTED,
      email: null,
      emailLookupHash: null,
      memberId: REDACTED,
      memberIdLookupHash: null,
      phone: REDACTED,
      avatarUrl: "",
      avatarPublicId: null,
      authorizedRepresentative: null,
      decisionMaker: REDACTED,
      nextOfKinName: REDACTED,
      nextOfKinRelationship: REDACTED,
      nextOfKinPhone: REDACTED,
      nextOfKinEmail: REDACTED,
      nextOfKinAddress: REDACTED,
      insuranceProvider: REDACTED,
      insurancePlanName: REDACTED,
      insurancePlanType: REDACTED,
      insuranceMemberId: REDACTED,
      insuranceGroupNumber: REDACTED,
      insuranceSubscriberName: REDACTED,
      insuranceSubscriberRelationship: REDACTED,
      insurancePhone: REDACTED,
      anonymizedAt: new Date(),
    },
  });
}

export async function hardDeletePatientRecord(patientId: string) {
  await prisma.patient.delete({ where: { id: patientId } });
}

export async function runRetentionJob(
  mode: RetentionJobMode,
): Promise<RetentionJobReport> {
  const live = mode === "live";
  const now = new Date();
  const secretCutoff = getShortLivedSecretCutoffDate(now);

  const patients = await prisma.patient.findMany({
    where: { deletionRequestedAt: { not: null } },
    include: {
      visits: { select: { updatedAt: true } },
    },
  });

  const anonymizeCandidates: string[] = [];
  const hardDeleteCandidates: string[] = [];

  for (const patient of patients) {
    if (isPatientPastRetention(patient, now)) {
      hardDeleteCandidates.push(patient.id);
      continue;
    }

    if (!patient.anonymizedAt) {
      anonymizeCandidates.push(patient.id);
    }
  }

  const shortLivedSecretsPurged = await purgeShortLivedSecrets(
    secretCutoff,
    live,
  );

  let patientsAnonymized = 0;
  let patientsHardDeleted = 0;

  if (live) {
    for (const patientId of anonymizeCandidates) {
      await anonymizePatientRecord(patientId);
      patientsAnonymized += 1;
    }

    for (const patientId of hardDeleteCandidates) {
      await hardDeletePatientRecord(patientId);
      patientsHardDeleted += 1;
    }
  } else {
    patientsAnonymized = anonymizeCandidates.length;
    patientsHardDeleted = hardDeleteCandidates.length;
  }

  const report: RetentionJobReport = {
    mode,
    ranAt: now.toISOString(),
    evaluatedPatients: patients.length,
    patientsAnonymized,
    patientsHardDeleted,
    shortLivedSecretsPurged,
    patientsAnonymizeCandidates: anonymizeCandidates,
    patientsHardDeleteCandidates: hardDeleteCandidates,
  };

  logger.info("retention_job_completed", {
    category: "retention",
    ...report,
    patientsAnonymizeCandidates: report.patientsAnonymizeCandidates.length,
    patientsHardDeleteCandidates: report.patientsHardDeleteCandidates.length,
  });

  return report;
}
