/** HIPAA §6.4 in-context consent — telehealth and clinical-notes disclaimers. */
import { UserRole, type InContextConsentType } from "~/generated/prisma/client";
import { getActivePolicyVersion } from "~/lib/in-context-consent-policy";
import prisma from "~/lib/db";
import {
  formatAuditTargetResource,
  recordSecurityAuditEvent,
} from "~/lib/security-audit";
import { HttpError } from "~/middlewares/error-handler";
import type { TokenPayload } from "~/types";

export async function hasInContextConsent(
  userId: string,
  consentType: InContextConsentType,
) {
  const policyVersion = getActivePolicyVersion(consentType);
  const record = await prisma.inContextConsentAcknowledgment.findUnique({
    where: {
      userId_consentType_policyVersion: {
        userId,
        consentType,
        policyVersion,
      },
    },
    select: { id: true },
  });

  return Boolean(record);
}

export async function getDoctorInContextConsentStatus(userId: string) {
  const [telehealthSession, clinicalNotes] = await Promise.all([
    hasInContextConsent(userId, "TELEHEALTH_SESSION"),
    hasInContextConsent(userId, "CLINICAL_NOTES"),
  ]);

  return {
    telehealthSession,
    clinicalNotes,
    policyVersion: getActivePolicyVersion("TELEHEALTH_SESSION"),
  };
}

export async function acceptInContextConsent(
  auth: TokenPayload,
  consentType: InContextConsentType,
  context: { ipAddress?: string; userAgent?: string },
) {
  if (auth.role !== UserRole.DOCTOR) {
    throw new HttpError(
      "In-context consent applies to provider accounts only",
      403,
    );
  }

  const policyVersion = getActivePolicyVersion(consentType);
  const ipAddress = context.ipAddress?.trim() || "unknown";
  const userAgent = context.userAgent?.trim() || "unknown";

  await prisma.inContextConsentAcknowledgment.upsert({
    where: {
      userId_consentType_policyVersion: {
        userId: auth.id,
        consentType,
        policyVersion,
      },
    },
    create: {
      userId: auth.id,
      consentType,
      policyVersion,
      ipAddress,
      userAgent,
    },
    update: {},
  });

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { email: true },
  });

  await recordSecurityAuditEvent({
    eventType: "IN_CONTEXT_CONSENT_ACCEPTED",
    actorId: auth.id,
    actorRole: auth.role,
    actorEmail: user?.email.toLowerCase() ?? "unknown",
    targetResource: formatAuditTargetResource(
      "in_context_consent",
      `${consentType.toLowerCase()}:${policyVersion}`,
    ),
    context: { ipAddress, userAgent },
  });

  return getDoctorInContextConsentStatus(auth.id);
}

export async function assertDoctorTelehealthConsent(auth: TokenPayload) {
  if (auth.role !== UserRole.DOCTOR) {
    return;
  }

  if (!(await hasInContextConsent(auth.id, "TELEHEALTH_SESSION"))) {
    throw new HttpError(
      "Telehealth session disclaimer must be accepted before joining a video visit",
      428,
    );
  }
}

export async function assertDoctorClinicalNotesConsent(auth: TokenPayload) {
  if (auth.role !== UserRole.DOCTOR) {
    return;
  }

  if (!(await hasInContextConsent(auth.id, "CLINICAL_NOTES"))) {
    throw new HttpError(
      "Clinical documentation disclaimer must be accepted before accessing visit notes",
      428,
    );
  }
}
