/** HIPAA §3.1 security audit logging — centralized append-only event writer. */
import prisma from "~/lib/db";
import logger from "~/lib/logger";

export const SECURITY_AUDIT_EVENTS = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  ACCOUNT_LOCKOUT: "ACCOUNT_LOCKOUT",
  SIGNUP_COMPLETED: "SIGNUP_COMPLETED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  MFA_CHALLENGE_ISSUED: "MFA_CHALLENGE_ISSUED",
  MFA_CHALLENGE_PASSED: "MFA_CHALLENGE_PASSED",
  MFA_CHALLENGE_FAILED: "MFA_CHALLENGE_FAILED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  STEP_UP_AUTH_SUCCESS: "STEP_UP_AUTH_SUCCESS",
  STEP_UP_AUTH_FAILURE: "STEP_UP_AUTH_FAILURE",
  ADMIN_PROMOTED: "ADMIN_PROMOTED",
  PATIENT_RECORD_VIEWED: "PATIENT_RECORD_VIEWED",
  PATIENT_RECORD_UPDATED: "PATIENT_RECORD_UPDATED",
  PATIENT_RECORD_CREATED: "PATIENT_RECORD_CREATED",
  PATIENT_RECORD_DELETED: "PATIENT_RECORD_DELETED",
  PATIENT_RECORD_EXPORTED: "PATIENT_RECORD_EXPORTED",
  PRESCRIPTION_VIEWED: "PRESCRIPTION_VIEWED",
  PRESCRIPTION_CREATED: "PRESCRIPTION_CREATED",
  PRESCRIPTION_UPDATED: "PRESCRIPTION_UPDATED",
  PRESCRIPTION_DELETED: "PRESCRIPTION_DELETED",
  CLINICAL_NOTES_VIEWED: "CLINICAL_NOTES_VIEWED",
  CLINICAL_NOTES_UPDATED: "CLINICAL_NOTES_UPDATED",
  MESSAGE_SENT: "MESSAGE_SENT",
  MESSAGE_ACCESSED: "MESSAGE_ACCESSED",
  FILE_UPLOADED: "FILE_UPLOADED",
  FILE_ACCESSED: "FILE_ACCESSED",
  FILE_DELETED: "FILE_DELETED",
  APPOINTMENT_VIEWED: "APPOINTMENT_VIEWED",
  PATIENT_DELETION_REQUESTED: "PATIENT_DELETION_REQUESTED",
  RETENTION_JOB_RUN: "RETENTION_JOB_RUN",
  IN_CONTEXT_CONSENT_ACCEPTED: "IN_CONTEXT_CONSENT_ACCEPTED",
  KEY_UNWRAP_SUCCESS: "KEY_UNWRAP_SUCCESS",
  KEY_UNWRAP_FAILED: "KEY_UNWRAP_FAILED",
} as const;

export type SecurityAuditEventType =
  (typeof SECURITY_AUDIT_EVENTS)[keyof typeof SECURITY_AUDIT_EVENTS];

export type AuditRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type RecordSecurityAuditEventInput = {
  eventType: SecurityAuditEventType;
  actorId: string;
  actorRole: string;
  actorEmail: string;
  targetResource: string;
  context?: AuditRequestContext;
};

export function formatAuditTargetResource(type: string, id: string) {
  return `${type}:${id}`;
}

export function normalizeAuditContext(context: AuditRequestContext = {}) {
  return {
    ipAddress: context.ipAddress?.trim() || "unknown",
    userAgent: context.userAgent?.trim() || "unknown",
  };
}

/**
 * Append-only audit writer — the only application entry point for audit persistence.
 * Never call prisma.securityAuditEvent.update/delete/upsert elsewhere.
 * Do not store PHI (names, diagnoses, notes, message bodies) — use resource IDs only.
 */
export async function recordSecurityAuditEvent(
  input: RecordSecurityAuditEventInput,
): Promise<void> {
  const { ipAddress, userAgent } = normalizeAuditContext(input.context);

  try {
    await prisma.securityAuditEvent.create({
      data: {
        eventType: input.eventType,
        actorId: input.actorId,
        actorRole: input.actorRole,
        actorEmail: input.actorEmail.toLowerCase(),
        targetResource: input.targetResource,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error(
      `Failed to record security audit event ${input.eventType} for ${input.actorEmail}`,
    );
    logger.error(error);
  }
}
