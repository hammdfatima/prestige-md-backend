import { UserRole } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { issueSessionToken } from "~/lib/session-token";
import {
  revokeAccountSession,
  revokeOtherAccountSessions,
  touchAccountSession,
} from "~/services/account-session-service";
import type { TokenPayload } from "~/types";

export async function refreshSessionActivity(auth: TokenPayload) {
  if (auth.sessionId) {
    await touchAccountSession(auth.sessionId);
  }

  if (auth.role === UserRole.FACILITY_MANAGER) {
    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: auth.id },
      select: { id: true, tokenVersion: true },
    });

    return {
      token: issueSessionToken({
        id: facility.id,
        role: UserRole.FACILITY_MANAGER,
        tokenVersion: facility.tokenVersion,
        sessionId: auth.sessionId,
      }),
    };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: auth.id },
    select: { id: true, role: true, tokenVersion: true },
  });

  return {
    token: issueSessionToken({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: auth.sessionId,
    }),
  };
}

export async function idleLogout(auth: TokenPayload) {
  if (auth.sessionId) {
    await revokeAccountSession(auth.sessionId);
    return;
  }

  if (auth.role === UserRole.FACILITY_MANAGER) {
    await prisma.facility.update({
      where: { id: auth.id },
      data: { tokenVersion: { increment: 1 } },
    });
    return;
  }

  await prisma.user.update({
    where: { id: auth.id },
    data: { tokenVersion: { increment: 1 } },
  });
}

export {
  listActiveAccountSessions,
  revokeOtherAccountSessions,
} from "~/services/account-session-service";
