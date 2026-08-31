import { UserRole, UserStatus } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { isSessionIdleExpired } from "~/lib/session-idle";
import { normalizeTeamPermissions } from "~/lib/permissions";
import { assertAccountSessionActive } from "~/services/account-session-service";
import { HttpError } from "~/middlewares/error-handler";
import { status as HttpStatus } from "http-status";
import type { TokenPayload } from "~/types";

type ValidateSessionTokenOptions = {
  skipIdleCheck?: boolean;
  allowedRoles?: UserRole[];
};

/** Shared token validation for HTTP middleware and Socket.io. */
export async function validateSessionToken(
  payload: TokenPayload & { iat?: number },
  options: ValidateSessionTokenOptions = {},
): Promise<TokenPayload> {
  if (
    !options.skipIdleCheck &&
    isSessionIdleExpired(payload.lastActiveAt, Date.now(), payload.iat)
  ) {
    throw new HttpError(
      "Session expired due to inactivity",
      HttpStatus.UNAUTHORIZED,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      role: true,
      status: true,
      tokenVersion: true,
      permissions: true,
      facilityId: true,
      facilityLinks: { select: { facilityId: true }, take: 1 },
    },
  });

  if (user) {
    if (user.status !== UserStatus.ACTIVE) {
      throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
    }

    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
    }

    await assertAccountSessionActive(payload.sessionId, user.id);

    if (
      options.allowedRoles &&
      options.allowedRoles.length > 0 &&
      !options.allowedRoles.includes(user.role)
    ) {
      throw new HttpError(
        "You do not have access to this resource",
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: user.id,
      role: user.role,
      permissions: normalizeTeamPermissions(user.permissions),
      facilityId: user.facilityId ?? user.facilityLinks[0]?.facilityId ?? null,
      sessionId: payload.sessionId,
      lastActiveAt: payload.lastActiveAt,
      tokenVersion: user.tokenVersion,
    };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: payload.id },
    select: { id: true, status: true, tokenVersion: true },
  });

  if (!facility || facility.status !== UserStatus.ACTIVE) {
    throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
  }

  if ((payload.tokenVersion ?? 0) !== facility.tokenVersion) {
    throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
  }

  await assertAccountSessionActive(payload.sessionId, facility.id);

  if (
    options.allowedRoles &&
    options.allowedRoles.length > 0 &&
    !options.allowedRoles.includes(UserRole.FACILITY_MANAGER)
  ) {
    throw new HttpError(
      "You do not have access to this resource",
      HttpStatus.FORBIDDEN,
    );
  }

  return {
    id: facility.id,
    role: UserRole.FACILITY_MANAGER,
    facilityId: facility.id,
    sessionId: payload.sessionId,
    lastActiveAt: payload.lastActiveAt,
    tokenVersion: facility.tokenVersion,
  };
}
