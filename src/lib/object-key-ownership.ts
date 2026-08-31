/** HIPAA §2.3 object-key prefixes — facility/org scoped Cloudinary keys. */
import { status as HttpStatus } from "http-status";

import { HttpError } from "~/middlewares/error-handler";
import type { TokenPayload } from "~/types";

/** Org id for platform admins/team members without a facility assignment. */
export const PLATFORM_ORG_ID = "platform";

const ROOT_PREFIX = "prestigemd";

/**
 * Reject malformed or traversal-style keys before any ownership comparison.
 */
export function normalizeObjectKey(publicId: string) {
  const key = publicId.trim();

  if (!key || key.includes("..") || key.startsWith("/")) {
    throw new HttpError("File not found", HttpStatus.NOT_FOUND);
  }

  return key;
}

export function resolveOrgId(auth: TokenPayload) {
  return auth.facilityId ?? PLATFORM_ORG_ID;
}

/** Namespaced prefix for new uploads: org/{orgId}/user/{userId} */
export function buildUserObjectPrefix(auth: TokenPayload) {
  const orgId = resolveOrgId(auth);
  return `${ROOT_PREFIX}/org/${orgId}/user/${auth.id}`;
}

/** Legacy prefix kept for objects uploaded before org scoping. */
export function legacyUserObjectPrefix(userId: string) {
  return `${ROOT_PREFIX}/${userId}`;
}

export function ownedObjectPrefixes(auth: TokenPayload) {
  return [
    `${buildUserObjectPrefix(auth)}/`,
    `${legacyUserObjectPrefix(auth.id)}/`,
  ];
}

export function isObjectKeyOwnedByCaller(
  auth: TokenPayload,
  publicId: string,
) {
  const key = normalizeObjectKey(publicId);
  return ownedObjectPrefixes(auth).some((prefix) => key.startsWith(prefix));
}

/**
 * Returns 404 (not 403) when the key is outside the caller's namespace,
 * consistent with relationship-scoped lookups elsewhere in the API.
 */
export function assertCallerOwnsObjectKey(
  auth: TokenPayload,
  publicId: string,
) {
  if (!isObjectKeyOwnedByCaller(auth, publicId)) {
    throw new HttpError("File not found", HttpStatus.NOT_FOUND);
  }
}

export function assertOptionalCallerOwnsObjectKey(
  auth: TokenPayload,
  publicId?: string | null,
) {
  const trimmed = publicId?.trim();
  if (!trimmed) {
    return;
  }

  assertCallerOwnsObjectKey(auth, trimmed);
}
