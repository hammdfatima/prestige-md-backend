/** HIPAA §4.1 field encryption at rest — AES-256-GCM application-layer encryption. */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

import {
  assertKeyManagementReady,
  getActiveKeyVersion,
  getDataKey,
} from "~/lib/key-management/key-registry";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const LEGACY_PREFIX = "enc:v1:";
const VERSIONED_PREFIX = "enc:v2:";

function parseEncryptedValue(value: string) {
  if (value.startsWith(VERSIONED_PREFIX)) {
    const rest = value.slice(VERSIONED_PREFIX.length);
    const colonIndex = rest.indexOf(":");

    if (colonIndex <= 0) {
      throw new Error("Invalid versioned encrypted field payload");
    }

    return {
      keyVersion: rest.slice(0, colonIndex),
      payload: rest.slice(colonIndex + 1),
    };
  }

  if (value.startsWith(LEGACY_PREFIX)) {
    return {
      keyVersion: null,
      payload: value.slice(LEGACY_PREFIX.length),
    };
  }

  throw new Error("Value is not encrypted");
}

function resolveKeyForEncrypt() {
  assertKeyManagementReady();
  return getDataKey();
}

function resolveKeyForDecrypt(keyVersion: string | null) {
  assertKeyManagementReady();

  if (keyVersion) {
    return getDataKey(keyVersion);
  }

  try {
    return getDataKey("legacy-v1");
  } catch {
    return getDataKey();
  }
}

export function isEncryptedValue(value: string) {
  return value.startsWith(LEGACY_PREFIX) || value.startsWith(VERSIONED_PREFIX);
}

export function encryptField(
  plaintext: string | null | undefined,
): string | null | undefined {
  if (plaintext == null) {
    return plaintext;
  }

  const trimmed = plaintext.trim();
  if (!trimmed) {
    return plaintext === "" ? "" : plaintext;
  }

  if (isEncryptedValue(trimmed)) {
    return trimmed;
  }

  const key = resolveKeyForEncrypt();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, ciphertext]);
  const keyVersion = getActiveKeyVersion();

  return `${VERSIONED_PREFIX}${keyVersion}:${payload.toString("base64url")}`;
}

export function decryptField(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) {
    return value;
  }

  if (!isEncryptedValue(value)) {
    return value;
  }

  const { keyVersion, payload: encodedPayload } = parseEncryptedValue(value);
  const key = resolveKeyForDecrypt(keyVersion);
  const payload = Buffer.from(encodedPayload, "base64url");

  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted field payload");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashLookupValue(value: string) {
  const key = resolveKeyForEncrypt();
  return createHmac("sha256", key).update(value.trim().toLowerCase()).digest("hex");
}

export function emailLookupHash(email: string) {
  return hashLookupValue(normalizeEmail(email));
}
