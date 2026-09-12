import { formatWhenLabel } from "~/lib/timezone"
import type { VisitStatus } from "~/generated/prisma/client"
import { getAppBaseUrl } from "~/lib/app-url"
import {
  buildVisitBookedEmail,
  buildVisitReminderEmail,
  buildVisitStatusEmail,
} from "~/lib/emails/templates"
import logger from "~/lib/logger"
import { sendEmail } from "~/lib/mailer"
import {
  notifyVisitBookedInApp,
  notifyVisitReminderInApp,
  notifyVisitStatusInApp,
} from "~/lib/notifications/visit-notifications"

type VisitEmailParticipant = {
  id: string
  firstName: string
  lastName: string
  email: string
  timezone?: string | null
}

export type VisitEmailPayload = {
  id: string
  reason: string
  scheduledAt: Date
  status: VisitStatus
  facilityId: string
  patient: { id: string; firstName: string; lastName: string }
  provider: VisitEmailParticipant
  bookedBy: VisitEmailParticipant
}

function appUrl() {
  return getAppBaseUrl()
}

function personName(user: VisitEmailParticipant) {
  return `${user.firstName} ${user.lastName}`.trim() || "there"
}

function whenLabel(scheduledAt: Date, timeZone?: string | null) {
  return formatWhenLabel(scheduledAt, timeZone)
}

function doctorPortalUrl(visitId: string) {
  return `${appUrl()}/doctor/appointments/${visitId}`
}

function nursePortalUrl(_visitId: string) {
  return `${appUrl()}/nurse/appointments`
}

async function safeSend(
  label: string,
  work: () => Promise<boolean>,
) {
  try {
    const sent = await work()
    if (!sent) {
      logger.warn(`Email not delivered: ${label}`)
    }
  } catch (error) {
    logger.error(error)
    logger.warn(`Email failed: ${label}`)
  }
}

export async function notifyVisitBooked(visit: VisitEmailPayload) {
  await Promise.all([
    notifyVisitBookedInApp(visit),
    safeSend(`visit-booked doctor ${visit.id}`, () =>
      sendEmail(
        buildVisitBookedEmail({
          toName: personName(visit.provider),
          toEmail: visit.provider.email,
          whenLabel: whenLabel(visit.scheduledAt, visit.provider.timezone),
          portalUrl: doctorPortalUrl(visit.id),
          recipientRole: "doctor",
        }),
      ),
    ),
    visit.bookedBy.id !== visit.provider.id
      ? safeSend(`visit-booked nurse ${visit.id}`, () =>
          sendEmail(
            buildVisitBookedEmail({
              toName: personName(visit.bookedBy),
              toEmail: visit.bookedBy.email,
              whenLabel: whenLabel(visit.scheduledAt, visit.bookedBy.timezone),
              portalUrl: nursePortalUrl(visit.id),
              recipientRole: "nurse",
            }),
          ),
        )
      : Promise.resolve(),
  ])
}

export async function notifyVisitReminder(visit: VisitEmailPayload) {
  await Promise.all([
    notifyVisitReminderInApp(visit),
    safeSend(`visit-reminder doctor ${visit.id}`, () =>
      sendEmail(
        buildVisitReminderEmail({
          toName: personName(visit.provider),
          toEmail: visit.provider.email,
          whenLabel: whenLabel(visit.scheduledAt, visit.provider.timezone),
          portalUrl: doctorPortalUrl(visit.id),
        }),
      ),
    ),
    visit.bookedBy.id !== visit.provider.id
      ? safeSend(`visit-reminder nurse ${visit.id}`, () =>
          sendEmail(
            buildVisitReminderEmail({
              toName: personName(visit.bookedBy),
              toEmail: visit.bookedBy.email,
              whenLabel: whenLabel(visit.scheduledAt, visit.bookedBy.timezone),
              portalUrl: nursePortalUrl(visit.id),
            }),
          ),
        )
      : Promise.resolve(),
  ])
}

export async function notifyVisitStatus(
  visit: VisitEmailPayload,
  status: "cancelled" | "completed" | "missed",
) {
  const statusLabel =
    status === "cancelled"
      ? "Cancelled"
      : status === "completed"
        ? "Completed"
        : "Missed"

  const recipients = [
    {
      user: visit.provider,
      portalUrl: doctorPortalUrl(visit.id),
    },
    {
      user: visit.bookedBy,
      portalUrl: nursePortalUrl(visit.id),
    },
  ].filter(
    (item, index, list) =>
      list.findIndex((other) => other.user.id === item.user.id) === index,
  )

  await Promise.all([
    notifyVisitStatusInApp(visit, status),
    ...recipients.map((item) =>
      safeSend(`visit-${status} ${item.user.id} ${visit.id}`, () =>
        sendEmail(
          buildVisitStatusEmail({
            toName: personName(item.user),
            toEmail: item.user.email,
            whenLabel: whenLabel(visit.scheduledAt, item.user.timezone),
            statusLabel,
            portalUrl: item.portalUrl,
          }),
        ),
      ),
    ),
  ])
}
