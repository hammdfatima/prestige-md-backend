/** HIPAA §3.3 PHI access audit — resource IDs only, never PHI in audit payloads. */
import { UserRole } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import logger from "~/lib/logger";
import {
  formatAuditTargetResource,
  recordSecurityAuditEvent,
  SECURITY_AUDIT_EVENTS,
  type AuditRequestContext,
  type SecurityAuditEventType,
} from "~/lib/security-audit";
import type { TokenPayload } from "~/types";

/** Resource IDs and action types only — never patient names, diagnoses, or message bodies. */
const PHI_SAFE_TARGET_PATTERN = /^[a-z_]+:[a-zA-Z0-9_./-]+$/;

async function resolveActorEmail(auth: TokenPayload): Promise<string> {
  if (auth.role === UserRole.FACILITY_MANAGER) {
    const facility = await prisma.facility.findUnique({
      where: { id: auth.id },
      select: { email: true },
    });
    return facility?.email.toLowerCase() ?? "unknown";
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { email: true },
  });
  return user?.email.toLowerCase() ?? "unknown";
}

function assertPhiSafeTargetResource(targetResource: string) {
  if (!PHI_SAFE_TARGET_PATTERN.test(targetResource)) {
    throw new Error("Audit target must be a type:id reference without PHI");
  }
  if (targetResource.includes("@") || /\s/.test(targetResource)) {
    throw new Error("Audit target must not contain email addresses or whitespace");
  }
}

export async function recordPhiAccessAudit(input: {
  auth: TokenPayload;
  eventType: SecurityAuditEventType;
  targetResource: string;
  context?: AuditRequestContext;
}) {
  assertPhiSafeTargetResource(input.targetResource);

  const actorEmail = await resolveActorEmail(input.auth);

  await recordSecurityAuditEvent({
    eventType: input.eventType,
    actorId: input.auth.id,
    actorRole: input.auth.role,
    actorEmail,
    targetResource: input.targetResource,
    context: input.context,
  });
}

function logPhiAccess(
  auth: TokenPayload,
  eventType: SecurityAuditEventType,
  targetType: string,
  targetId: string,
  context?: AuditRequestContext,
) {
  void recordPhiAccessAudit({
    auth,
    eventType,
    targetResource: formatAuditTargetResource(targetType, targetId),
    context,
  }).catch((error) => {
    logger.error(`Failed to record PHI access audit event ${eventType}`);
    logger.error(error);
  });
}

export function recordPatientRecordViewed(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_RECORD_VIEWED,
    "patient",
    patientId,
    context,
  );
}

export function recordPatientRecordUpdated(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_RECORD_UPDATED,
    "patient",
    patientId,
    context,
  );
}

export function recordPatientRecordCreated(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_RECORD_CREATED,
    "patient",
    patientId,
    context,
  );
}

export function recordPatientRecordDeleted(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_RECORD_DELETED,
    "patient",
    patientId,
    context,
  );
}

export function recordPatientDeletionRequested(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_DELETION_REQUESTED,
    "patient",
    patientId,
    context,
  );
}

export function recordPatientRecordExported(
  auth: TokenPayload,
  targetId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PATIENT_RECORD_EXPORTED,
    "patient_export",
    targetId,
    context,
  );
}

export function recordPrescriptionViewed(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PRESCRIPTION_VIEWED,
    "patient",
    patientId,
    context,
  );
}

export function recordPrescriptionCreated(
  auth: TokenPayload,
  prescriptionId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PRESCRIPTION_CREATED,
    "prescription",
    prescriptionId,
    context,
  );
}

export function recordPrescriptionUpdated(
  auth: TokenPayload,
  prescriptionId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PRESCRIPTION_UPDATED,
    "prescription",
    prescriptionId,
    context,
  );
}

export function recordPrescriptionDeleted(
  auth: TokenPayload,
  prescriptionId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.PRESCRIPTION_DELETED,
    "prescription",
    prescriptionId,
    context,
  );
}

export function recordClinicalNotesViewed(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.CLINICAL_NOTES_VIEWED,
    "patient",
    patientId,
    context,
  );
}

export function recordClinicalNotesUpdated(
  auth: TokenPayload,
  patientId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.CLINICAL_NOTES_UPDATED,
    "patient",
    patientId,
    context,
  );
}

export function recordVisitClinicalNotesUpdated(
  auth: TokenPayload,
  visitId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.CLINICAL_NOTES_UPDATED,
    "visit",
    visitId,
    context,
  );
}

export function recordMessageAccessed(
  auth: TokenPayload,
  visitId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.MESSAGE_ACCESSED,
    "visit",
    visitId,
    context,
  );
}

export function recordMessageSent(
  auth: TokenPayload,
  messageId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.MESSAGE_SENT,
    "message",
    messageId,
    context,
  );
}

export function recordFileUploaded(
  auth: TokenPayload,
  filePublicId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.FILE_UPLOADED,
    "file",
    filePublicId,
    context,
  );
}

export function recordFileAccessed(
  auth: TokenPayload,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.FILE_ACCESSED,
    "file_library",
    auth.id,
    context,
  );
}

export function recordFileDeleted(
  auth: TokenPayload,
  filePublicId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.FILE_DELETED,
    "file",
    filePublicId,
    context,
  );
}

export function recordAppointmentViewed(
  auth: TokenPayload,
  visitId: string,
  context?: AuditRequestContext,
) {
  logPhiAccess(
    auth,
    SECURITY_AUDIT_EVENTS.APPOINTMENT_VIEWED,
    "visit",
    visitId,
    context,
  );
}

export function resolveAuditTargetLabel(targetResource: string) {
  const type = targetResource.split(":")[0];
  switch (type) {
    case "patient":
      return "Patient record";
    case "patient_export":
      return "Patient export";
    case "retention_job":
      return "Retention job";
    case "prescription":
      return "Prescription";
    case "visit":
      return "Appointment";
    case "message":
      return "Message";
    case "file":
      return "File";
    case "file_library":
      return "File library";
    case "login_attempt":
      return "Login attempt";
    case "user":
      return "User account";
    case "facility":
      return "Facility account";
    case "action":
      return "Protected action";
    default:
      return "Resource";
  }
}
