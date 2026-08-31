/** HIPAA §4.2 key management — KMS-wrapped DEK in production. */
import { createHmac } from "node:crypto";

import env from "~/env";
import {
  logKeyUsage,
  recordKeyManagementAudit,
} from "~/lib/key-management/key-usage-audit";
import {
  getActiveKeyVersion,
  getDataKey,
  logRegisteredKeys,
  registerDataKey,
} from "~/lib/key-management/key-registry";
import type { KeyManagementProviderName } from "~/lib/key-management/types";
import logger from "~/lib/logger";

function resolveEnvMaterialKey(): Buffer {
  const configured = env.DATA_ENCRYPTION_KEY?.trim();

  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error(
        "DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64",
      );
    }
    return key;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATA_ENCRYPTION_KEY is required when KEY_MANAGEMENT_PROVIDER=env",
    );
  }

  logger.warn(
    "DATA_ENCRYPTION_KEY is unset — deriving a dev-only key from JWT_SECRET",
  );

  return createHmac("sha256", env.JWT_SECRET)
    .update("prestige-md-field-encryption")
    .digest();
}

async function initializeEnvProvider() {
  const key = resolveEnvMaterialKey();
  const version = env.DATA_ENCRYPTION_KEY_VERSION;

  registerDataKey(version, key, { setActive: true });

  logKeyUsage({
    operation: "ENV_KEY_LOAD",
    provider: "env",
    keyVersion: version,
    service: env.SERVICE_NAME,
    success: true,
  });
}

async function registerLegacyWrappedKeyIfConfigured() {
  const legacyWrapped = env.AWS_KMS_LEGACY_WRAPPED_DEK?.trim();
  const keyId = env.AWS_KMS_KEY_ID?.trim();
  const region = env.AWS_REGION?.trim();

  if (!legacyWrapped) {
    return;
  }

  if (!keyId || !region) {
    throw new Error(
      "AWS_KMS_KEY_ID and AWS_REGION are required when AWS_KMS_LEGACY_WRAPPED_DEK is set",
    );
  }

  const { unwrapDataKeyFromKms } = await import(
    "~/lib/key-management/providers/aws-kms-provider"
  );

  const { keyMaterial } = await unwrapDataKeyFromKms({
    wrappedDekBase64: legacyWrapped,
    region,
    expectedKeyId: keyId,
  });

  const legacyVersion = env.DATA_ENCRYPTION_LEGACY_KEY_VERSION ?? "legacy";
  registerDataKey(legacyVersion, keyMaterial);
}

async function initializeAwsKmsProvider() {
  const keyId = env.AWS_KMS_KEY_ID?.trim();
  const wrappedDek = env.AWS_KMS_WRAPPED_DEK?.trim();
  const region = env.AWS_REGION?.trim();

  if (!keyId || !wrappedDek || !region) {
    throw new Error(
      "AWS_KMS_KEY_ID, AWS_KMS_WRAPPED_DEK, and AWS_REGION are required when KEY_MANAGEMENT_PROVIDER=aws-kms",
    );
  }

  const { unwrapDataKeyFromKms } = await import(
    "~/lib/key-management/providers/aws-kms-provider"
  );

  try {
    const { keyMaterial, kmsKeyId } = await unwrapDataKeyFromKms({
      wrappedDekBase64: wrappedDek,
      region,
      expectedKeyId: keyId,
    });

    registerDataKey(env.DATA_ENCRYPTION_KEY_VERSION, keyMaterial, {
      setActive: true,
    });

    await recordKeyManagementAudit(
      "KEY_UNWRAP_SUCCESS",
      `kms_key:${kmsKeyId}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "KMS key unwrap failed";
    await recordKeyManagementAudit("KEY_UNWRAP_FAILED", `kms_key:${keyId}`, {
      errorMessage: message,
    });
    throw error;
  }

  await registerLegacyWrappedKeyIfConfigured();
}

export async function initializeKeyManagement() {
  const provider: KeyManagementProviderName = env.KEY_MANAGEMENT_PROVIDER;

  if (provider === "aws-kms") {
    await initializeAwsKmsProvider();
  } else {
    await initializeEnvProvider();
  }

  const activeVersion = getActiveKeyVersion();
  registerDataKey("legacy-v1", Buffer.from(getDataKey(activeVersion)));

  logRegisteredKeys();
}

export function getKeyManagementProvider(): KeyManagementProviderName {
  return env.KEY_MANAGEMENT_PROVIDER;
}
