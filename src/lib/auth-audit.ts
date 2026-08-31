import { createHash } from "node:crypto";
import { UserRole } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import logger from "~/lib/logger";
import {
  formatAuditTargetResource,
  recordSecurityAuditEvent,
  SECURITY_AUDIT_EVENTS,
  type AuditRequestContext,
} from "~/lib/security-audit";
import type { TokenPayload } from "~/types";

type AuthAccountRef = {
  kind: "user" | "facility";
  id: string;
  email: string;
  role: string;
};

type LoginAccountLike =
  | { kind: "user"; record: { id: string; email: string; role: UserRole } }
  | { kind: "facility"; record: { id: string; email: string } };

function hashUnknownActorId(email: string) {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

function toAuthAccountRef(account: LoginAccountLike): AuthAccountRef;
function toAuthAccountRef(account: {
  kind: "user";
  record: { id: string; email: string; role: UserRole };
}): AuthAccountRef;
function toAuthAccountRef(account: {
  kind: "facility";
  record: { id: string; email: string };
}): AuthAccountRef;
function toAuthAccountRef(
  account:
    | LoginAccountLike
    | { kind: "user"; record: { id: string; email: string; role: UserRole } }
    | { kind: "facility"; record: { id: string; email: string } },
): AuthAccountRef {
  if (account.kind === "user") {
    return {
      kind: "user",
      id: account.record.id,
      email: account.record.email,
      role: account.record.role,
    };
  }

  return {
    kind: "facility",
    id: account.record.id,
    email: account.record.email,
    role: UserRole.FACILITY_MANAGER,
  };
}

function targetForAccount(account: AuthAccountRef) {
  return formatAuditTargetResource(account.kind, account.id);
}

function logAuthEvent(
  input: Parameters<typeof recordSecurityAuditEvent>[0],
) {
  void recordSecurityAuditEvent(input).catch((error) => {
    logger.error(`Failed to record auth audit event ${input.eventType}`);
    logger.error(error);
  });
}

export function recordLoginFailed(
  email: string,
  account: AuthAccountRef | null,
  ctx: AuditRequestContext = {},
) {
  if (account) {
    logAuthEvent({
      eventType: SECURITY_AUDIT_EVENTS.LOGIN_FAILED,
      actorId: account.id,
      actorRole: account.role,
      actorEmail: account.email,
      targetResource: targetForAccount(account),
      context: ctx,
    });
    return;
  }

  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.LOGIN_FAILED,
    actorId: hashUnknownActorId(email),
    actorRole: "UNAUTHENTICATED",
    actorEmail: email.trim().toLowerCase(),
    targetResource: "login_attempt:unknown",
    context: ctx,
  });
}

export function recordLoginSuccess(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.LOGIN_SUCCESS,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordAccountLockout(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.ACCOUNT_LOCKOUT,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordSignupCompleted(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.SIGNUP_COMPLETED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordPasswordChanged(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.PASSWORD_CHANGED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordPasswordResetRequested(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordPasswordResetCompleted(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.PASSWORD_RESET_COMPLETED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordMfaChallengeIssued(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.MFA_CHALLENGE_ISSUED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordMfaChallengePassed(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.MFA_CHALLENGE_PASSED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export function recordMfaChallengeFailed(
  account: AuthAccountRef,
  ctx: AuditRequestContext = {},
) {
  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.MFA_CHALLENGE_FAILED,
    actorId: account.id,
    actorRole: account.role,
    actorEmail: account.email,
    targetResource: targetForAccount(account),
    context: ctx,
  });
}

export async function recordPasswordChangedForAuth(
  auth: TokenPayload,
  ctx: AuditRequestContext = {},
) {
  const targetType =
    auth.role === UserRole.FACILITY_MANAGER ? "facility" : "user";

  if (auth.role === UserRole.FACILITY_MANAGER) {
    const facility = await prisma.facility.findUnique({
      where: { id: auth.id },
      select: { email: true },
    });

    logAuthEvent({
      eventType: SECURITY_AUDIT_EVENTS.PASSWORD_CHANGED,
      actorId: auth.id,
      actorRole: auth.role,
      actorEmail: facility?.email.toLowerCase() ?? "unknown",
      targetResource: formatAuditTargetResource(targetType, auth.id),
      context: ctx,
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { email: true },
  });

  logAuthEvent({
    eventType: SECURITY_AUDIT_EVENTS.PASSWORD_CHANGED,
    actorId: auth.id,
    actorRole: auth.role,
    actorEmail: user?.email.toLowerCase() ?? "unknown",
    targetResource: formatAuditTargetResource(targetType, auth.id),
    context: ctx,
  });
}

export { toAuthAccountRef };
