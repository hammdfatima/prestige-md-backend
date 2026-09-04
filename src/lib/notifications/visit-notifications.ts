import { NotificationType } from "~/generated/prisma/client"
import logger from "~/lib/logger"
import type { VisitEmailPayload } from "~/lib/emails/visit-notifications"
import {
  createNotifications,
  listAdminRecipientIds,
  type NotificationInput,
} from "~/services/notification-service"

const SECURE_PORTAL_HINT =
  "Open PrestigeMD to view patient and clinical details securely."

function doctorHref(visitId: string) {
  return `/doctor/appointments/${visitId}`
}

function nurseHref() {
  return `/nurse/appointments`
}

function adminHref() {
  return `/admin/appointments`
}

function facilityHref() {
  return `/facility/appointments`
}

async function safeNotify(label: string, work: () => Promise<unknown>) {
  try {
    await work()
  } catch (error) {
    logger.error(error)
    logger.warn(`In-app notification failed: ${label}`)
  }
}

async function withOrgRecipients(
  visit: VisitEmailPayload,
  base: NotificationInput[],
  options?: { includeAdmins?: boolean; includeFacility?: boolean },
) {
  const includeAdmins = options?.includeAdmins ?? true
  const includeFacility = options?.includeFacility ?? true
  const items = [...base]

  if (includeFacility && visit.facilityId) {
    items.push({
      recipientId: visit.facilityId,
      type: base[0]?.type ?? NotificationType.VISIT_BOOKED,
      title: base[0]?.title ?? "Visit update",
      body: base[0]?.body ?? SECURE_PORTAL_HINT,
      href: facilityHref(),
      visitId: visit.id,
    })
  }

  if (includeAdmins) {
    const adminIds = await listAdminRecipientIds()
    for (const adminId of adminIds) {
      items.push({
        recipientId: adminId,
        type: base[0]?.type ?? NotificationType.VISIT_BOOKED,
        title: base[0]?.title ?? "Visit update",
        body: base[0]?.body ?? SECURE_PORTAL_HINT,
        href: adminHref(),
        visitId: visit.id,
      })
    }
  }

  return createNotifications(items)
}

export async function notifyVisitBookedInApp(visit: VisitEmailPayload) {
  const body = SECURE_PORTAL_HINT

  await safeNotify(`visit-booked ${visit.id}`, () =>
    withOrgRecipients(visit, [
      {
        recipientId: visit.provider.id,
        type: NotificationType.VISIT_BOOKED,
        title: "Visit booked",
        body,
        href: doctorHref(visit.id),
        visitId: visit.id,
      },
      {
        recipientId: visit.bookedBy.id,
        type: NotificationType.VISIT_BOOKED,
        title: "Visit booked",
        body,
        href: nurseHref(),
        visitId: visit.id,
      },
    ]),
  )
}

export async function notifyVisitReminderInApp(visit: VisitEmailPayload) {
  const body = SECURE_PORTAL_HINT

  await safeNotify(`visit-reminder ${visit.id}`, () =>
    withOrgRecipients(
      visit,
      [
        {
          recipientId: visit.provider.id,
          type: NotificationType.VISIT_REMINDER,
          title: "Visit starting soon",
          body,
          href: doctorHref(visit.id),
          visitId: visit.id,
        },
        {
          recipientId: visit.bookedBy.id,
          type: NotificationType.VISIT_REMINDER,
          title: "Visit starting soon",
          body,
          href: nurseHref(),
          visitId: visit.id,
        },
      ],
      { includeAdmins: false, includeFacility: true },
    ),
  )
}

export async function notifyVisitStatusInApp(
  visit: VisitEmailPayload,
  status: "cancelled" | "completed" | "missed",
) {
  const type =
    status === "cancelled"
      ? NotificationType.VISIT_CANCELLED
      : status === "completed"
        ? NotificationType.VISIT_COMPLETED
        : NotificationType.VISIT_MISSED
  const title =
    status === "cancelled"
      ? "Visit cancelled"
      : status === "completed"
        ? "Visit completed"
        : "Visit missed"
  const body = SECURE_PORTAL_HINT

  await safeNotify(`visit-${status} ${visit.id}`, () =>
    withOrgRecipients(visit, [
      {
        recipientId: visit.provider.id,
        type,
        title,
        body,
        href: doctorHref(visit.id),
        visitId: visit.id,
      },
      {
        recipientId: visit.bookedBy.id,
        type,
        title,
        body,
        href: nurseHref(),
        visitId: visit.id,
      },
    ]),
  )
}

export async function notifyVisitMessageInApp(input: {
  recipientId: string
  recipientRole: "DOCTOR" | "NURSE"
  visitId: string
}) {
  const href =
    input.recipientRole === "DOCTOR"
      ? doctorHref(input.visitId)
      : nurseHref()

  await safeNotify(`visit-message ${input.visitId}`, () =>
    createNotifications([
      {
        recipientId: input.recipientId,
        type: NotificationType.MESSAGE,
        title: "New visit message",
        body: SECURE_PORTAL_HINT,
        href,
        visitId: input.visitId,
      },
    ]),
  )
}
