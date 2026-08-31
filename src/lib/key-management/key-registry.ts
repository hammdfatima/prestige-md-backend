import logger from "~/lib/logger";

const keys = new Map<string, Buffer>();
let activeKeyVersion = "env-primary";

export function registerDataKey(
  version: string,
  keyMaterial: Buffer,
  options: { setActive?: boolean } = {},
) {
  if (keyMaterial.length !== 32) {
    throw new Error(`Encryption key version "${version}" must be 32 bytes`);
  }

  keys.set(version, keyMaterial);

  if (options.setActive) {
    activeKeyVersion = version;
  }
}

export function getActiveKeyVersion() {
  return activeKeyVersion;
}

export function getDataKey(version?: string) {
  const resolvedVersion = version ?? activeKeyVersion;
  const key = keys.get(resolvedVersion);

  if (!key) {
    throw new Error(`Unknown encryption key version: ${resolvedVersion}`);
  }

  return key;
}

export function listRegisteredKeyVersions() {
  return [...keys.keys()];
}

export function assertKeyManagementReady() {
  if (keys.size === 0) {
    throw new Error(
      "Key management is not initialized — call initializeKeyManagement() at startup",
    );
  }
}

export function logRegisteredKeys() {
  logger.info(
    `Key registry ready (active=${activeKeyVersion}, versions=${listRegisteredKeyVersions().join(", ")})`,
  );
}
