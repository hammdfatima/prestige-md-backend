/** HIPAA §7.1 session management — create, list, and revoke account sessions. */
import { UserRole } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import {
  describeUserAgent,
  getDeviceFingerprint,
} from "~/lib/login-device";
import { HttpError } from "~/middlewares/error-handler";
import { status as HttpStatus } from "http-status";
import type { TokenPayload } from "~/types";

type SessionContext = {
  ipAddress?: string;
  userAgent?: string;
};

function sessionOwnerFilter(auth: Pick<TokenPayload, "id" | "role">) {
  if (auth.role === UserRole.FACILITY_MANAGER) {
    return { facilityId: auth.id };
  }
  return { userId: auth.id };
}

export async function createAccountSession(
  auth: Pick<TokenPayload, "id" | "role">,
  ctx: SessionContext = {},
) {
  const deviceFingerprint = getDeviceFingerprint(ctx.userAgent);
  const deviceLabel = describeUserAgent(ctx.userAgent);
  const owner = sessionOwnerFilter(auth);

  return prisma.accountSession.create({
    data: {
      ...owner,
      deviceFingerprint,
      deviceLabel,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

export async function assertAccountSessionActive(
  sessionId: string | undefined,
  accountId: string,
) {
  if (!sessionId) {
    throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
  }

  const session = await prisma.accountSession.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      OR: [{ userId: accountId }, { facilityId: accountId }],
    },
    select: { id: true },
  });

  if (!session) {
    throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
  }
}

export async function touchAccountSession(sessionId: string) {
  await prisma.accountSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { lastActiveAt: new Date() },
  });
}

export async function revokeAccountSession(sessionId: string) {
  await prisma.accountSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllAccountSessions(
  auth: Pick<TokenPayload, "id" | "role">,
) {
  const owner = sessionOwnerFilter(auth);
  await prisma.accountSession.updateMany({
    where: {
      ...owner,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function revokeOtherAccountSessions(
  auth: Pick<TokenPayload, "id" | "role" | "sessionId">,
) {
  if (!auth.sessionId) {
    throw new HttpError(
      "Current session could not be identified",
      HttpStatus.BAD_REQUEST,
    );
  }

  const owner = sessionOwnerFilter(auth);
  await prisma.accountSession.updateMany({
    where: {
      ...owner,
      revokedAt: null,
      NOT: { id: auth.sessionId },
    },
    data: { revokedAt: new Date() },
  });
}

export async function listActiveAccountSessions(
  auth: Pick<TokenPayload, "id" | "role" | "sessionId">,
) {
  const owner = sessionOwnerFilter(auth);
  const sessions = await prisma.accountSession.findMany({
    where: {
      ...owner,
      revokedAt: null,
    },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      ipAddress: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceLabel: session.deviceLabel,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    isCurrent: session.id === auth.sessionId,
  }));
}
