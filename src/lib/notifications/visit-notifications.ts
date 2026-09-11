import { NotificationType } from "~/generated/prisma/client"
import logger from "~/lib/logger"
import prisma from "~/lib/db"
import { formatWhenLabel } from "~/lib/timezone"
import type { VisitEmailPayload } from "~/lib/emails/visit-notifications"
import {
  createNotifications,
  listAdminRecipients,
  type NotificationInput,
} from "~/services/notification-service"

const SECURE_PORTAL_HINT =
  "Open PrestigeMD to view patient and clinical details securely."

function visitWhenBody(scheduledAt: Date, timeZone?: string | null) {
  return `Scheduled for ${formatWhenLabel(scheduledAt, timeZone)}. ${SECURE_PORTAL_HINT}`
}

function doctorHref(visitId: string, tab?: string) {
  const path = `/doctor/appointments/${visitId}`
  return tab ? `${path}?tab=${encodeURIComponent(tab)}` : path
}

function nurseHref(visitId?: string, tab?: string) {
  if (!visitId) return `/nurse/appointments`
  const params = new URLSearchParams({ visit: visitId })
  if (tab) params.set("tab", tab)
  return `/nurse/appointments?${params.toString()}`
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
    const facility = await prisma.facility.findUnique({
      where: { id: visit.facilityId },
      select: { timezone: true },
    })
    items.push({
      recipientId: visit.facilityId,
      type: base[0]?.type ?? NotificationType.VISIT_BOOKED,
      title: base[0]?.title ?? "Visit update",
      body: visitWhenBody(visit.scheduledAt, facility?.timezone),
      href: facilityHref(),
      visitId: visit.id,
    })
  }

  if (includeAdmins) {
    const admins = await listAdminRecipients()
    for (const admin of admins) {
      items.push({
        recipientId: admin.id,
        type: base[0]?.type ?? NotificationType.VISIT_BOOKED,
        title: base[0]?.title ?? "Visit update",
        body: visitWhenBody(visit.scheduledAt, admin.timezone),
        href: adminHref(),
        visitId: visit.id,
      })
    }
  }

  return createNotifications(items)
}

export async function notifyVisitBookedInApp(visit: VisitEmailPayload) {
  await safeNotify(`visit-booked ${visit.id}`, () =>
    withOrgRecipients(visit, [
      {
        recipientId: visit.provider.id,
        type: NotificationType.VISIT_BOOKED,
        title: "Visit booked",
        body: visitWhenBody(visit.scheduledAt, visit.provider.timezone),
        href: doctorHref(visit.id),
        visitId: visit.id,
      },
      {
        recipientId: visit.bookedBy.id,
        type: NotificationType.VISIT_BOOKED,
        title: "Visit booked",
        body: visitWhenBody(visit.scheduledAt, visit.bookedBy.timezone),
        href: nurseHref(),
        visitId: visit.id,
      },
    ]),
  )
}

export async function notifyVisitReminderInApp(visit: VisitEmailPayload) {
  await safeNotify(`visit-reminder ${visit.id}`, () =>
    withOrgRecipients(
      visit,
      [
        {
          recipientId: visit.provider.id,
          type: NotificationType.VISIT_REMINDER,
          title: "Visit starting soon",
          body: visitWhenBody(visit.scheduledAt, visit.provider.timezone),
          href: doctorHref(visit.id),
          visitId: visit.id,
        },
        {
          recipientId: visit.bookedBy.id,
          type: NotificationType.VISIT_REMINDER,
          title: "Visit starting soon",
          body: visitWhenBody(visit.scheduledAt, visit.bookedBy.timezone),
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

  await safeNotify(`visit-${status} ${visit.id}`, () =>
    withOrgRecipients(visit, [
      {
        recipientId: visit.provider.id,
        type,
        title,
        body: visitWhenBody(visit.scheduledAt, visit.provider.timezone),
        href: doctorHref(visit.id),
        visitId: visit.id,
      },
      {
        recipientId: visit.bookedBy.id,
        type,
        title,
        body: visitWhenBody(visit.scheduledAt, visit.bookedBy.timezone),
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
      ? doctorHref(input.visitId, "messages")
      : nurseHref(input.visitId, "messages")

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
