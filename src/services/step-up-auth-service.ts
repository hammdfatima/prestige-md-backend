/** HIPAA §1.5 step-up authentication — re-auth for sensitive actions. */
import { status as HttpStatus } from "http-status";
import { comparePassword } from "~/lib/bycrpt";
import prisma from "~/lib/db";
import {
  formatAuditTargetResource,
  recordSecurityAuditEvent,
  SECURITY_AUDIT_EVENTS,
  type AuditRequestContext,
} from "~/lib/security-audit";
import {
  createStepUpToken,
  isValidStepUpToken,
  STEP_UP_TOKEN_TTL_SECONDS,
} from "~/lib/step-up-token";
import { HttpError } from "~/middlewares/error-handler";
import type { TokenPayload } from "~/types";

type StepUpContext = AuditRequestContext & {
  action?: string;
};

async function logStepUpAttempt(
  eventType:
    | typeof SECURITY_AUDIT_EVENTS.STEP_UP_AUTH_SUCCESS
    | typeof SECURITY_AUDIT_EVENTS.STEP_UP_AUTH_FAILURE,
  auth: TokenPayload,
  email: string,
  ctx: StepUpContext,
) {
  const action = ctx.action?.trim() || "step_up";

  await recordSecurityAuditEvent({
    eventType,
    actorId: auth.id,
    actorRole: auth.role,
    actorEmail: email,
    targetResource: formatAuditTargetResource("action", action),
    context: ctx,
  });
}

export function assertStepUpToken(auth: TokenPayload, stepUpToken: string) {
  if (!isValidStepUpToken(stepUpToken, auth.id)) {
    throw new HttpError(
      "Step-up authentication required or expired. Re-verify your password.",
      HttpStatus.FORBIDDEN,
    );
  }
}

export async function verifyStepUpPassword(
  auth: TokenPayload,
  password: string,
  ctx: StepUpContext = {},
) {
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    await logStepUpAttempt(
      SECURITY_AUDIT_EVENTS.STEP_UP_AUTH_FAILURE,
      auth,
      user?.email ?? "unknown",
      ctx,
    );
    throw new HttpError("Re-authentication failed", HttpStatus.UNAUTHORIZED);
  }

  const valid = await comparePassword({
    password,
    hash: user.passwordHash,
  });

  if (!valid) {
    await logStepUpAttempt(
      SECURITY_AUDIT_EVENTS.STEP_UP_AUTH_FAILURE,
      auth,
      user.email,
      ctx,
    );
    throw new HttpError("Re-authentication failed", HttpStatus.UNAUTHORIZED);
  }

  await logStepUpAttempt(
    SECURITY_AUDIT_EVENTS.STEP_UP_AUTH_SUCCESS,
    auth,
    user.email,
    ctx,
  );

  return {
    stepUpToken: createStepUpToken(user.id),
    expiresIn: STEP_UP_TOKEN_TTL_SECONDS,
  };
}
