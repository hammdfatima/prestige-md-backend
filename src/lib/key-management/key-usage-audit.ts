import env from "~/env";
import { recordSecurityAuditEvent } from "~/lib/security-audit";
import logger from "~/lib/logger";
import type { KeyUsageLogEntry } from "~/lib/key-management/types";

const SYSTEM_ACTOR = {
  actorId: "system",
  actorRole: "SYSTEM",
  actorEmail: "system@prestige-md.internal",
} as const;

export function logKeyUsage(entry: KeyUsageLogEntry) {
  logger.info("key_management_usage", {
    category: "key_management",
    operation: entry.operation,
    provider: entry.provider,
    keyVersion: entry.keyVersion,
    keyId: entry.keyId ?? null,
    service: entry.service,
    success: entry.success,
    errorMessage: entry.errorMessage ?? null,
    timestamp: new Date().toISOString(),
  });
}

export async function recordKeyManagementAudit(
  eventType: "KEY_UNWRAP_SUCCESS" | "KEY_UNWRAP_FAILED",
  targetResource: string,
  options: { errorMessage?: string } = {},
) {
  if (eventType === "KEY_UNWRAP_FAILED") {
    logKeyUsage({
      operation: "KMS_DECRYPT",
      provider: env.KEY_MANAGEMENT_PROVIDER,
      keyVersion: env.DATA_ENCRYPTION_KEY_VERSION,
      keyId: env.AWS_KMS_KEY_ID,
      service: env.SERVICE_NAME,
      success: false,
      errorMessage: options.errorMessage,
    });
  }

  await recordSecurityAuditEvent({
    eventType,
    ...SYSTEM_ACTOR,
    targetResource,
    context: {
      ipAddress: "system",
      userAgent: env.SERVICE_NAME,
    },
  });
}
