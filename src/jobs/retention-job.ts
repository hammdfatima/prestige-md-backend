import env from "~/env";
import type { RetentionJobMode, RetentionJobReport } from "~/lib/retention-config";
import logger from "~/lib/logger";
import {
  recordSecurityAuditEvent,
  formatAuditTargetResource,
} from "~/lib/security-audit";
import { runRetentionJob } from "~/services/retention-service";

const RETENTION_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

let retentionTimer: NodeJS.Timeout | null = null;

const SYSTEM_ACTOR = {
  actorId: "system",
  actorRole: "SYSTEM",
  actorEmail: "system@prestige-md.internal",
} as const;

export async function recordRetentionJobAudit(report: RetentionJobReport) {
  const targetResource = formatAuditTargetResource(
    "retention_job",
    `${report.mode}:evaluated=${report.evaluatedPatients}:anonymized=${report.patientsAnonymized}:deleted=${report.patientsHardDeleted}:secrets=${report.shortLivedSecretsPurged}`,
  );

  await recordSecurityAuditEvent({
    eventType: "RETENTION_JOB_RUN",
    ...SYSTEM_ACTOR,
    targetResource,
    context: {
      ipAddress: "system",
      userAgent: env.SERVICE_NAME,
    },
  });
}

export async function executeRetentionJob() {
  const mode: RetentionJobMode = env.RETENTION_JOB_LIVE ? "live" : "dry_run";

  try {
    const report = await runRetentionJob(mode);
    await recordRetentionJobAudit(report);
    return report;
  } catch (error) {
    logger.error("Retention job failed", error);
    throw error;
  }
}

export function startRetentionJob() {
  if (!env.RETENTION_JOB_ENABLED) {
    logger.info("Retention job disabled (RETENTION_JOB_ENABLED=false)");
    return;
  }

  if (retentionTimer) {
    return;
  }

  const tick = () => {
    void executeRetentionJob().catch((error) => {
      logger.error(error);
    });
  };

  tick();
  retentionTimer = setInterval(tick, RETENTION_JOB_INTERVAL_MS);

  logger.info(
    `Retention job started (every 24h, mode=${env.RETENTION_JOB_LIVE ? "live" : "dry_run"})`,
  );
}
