import { format } from "date-fns"
import type { User, VisitStatus } from "~/generated/prisma/client"
import env from "~/env"
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

type VisitEmailParticipant = Pick<
  User,
  "id" | "firstName" | "lastName" | "email"
>

export type VisitEmailPayload = {
  id: string
  reason: string
  scheduledAt: Date
  status: VisitStatus
  facilityId: string
  patient: { firstName: string; lastName: string }
  provider: VisitEmailParticipant
  bookedBy: VisitEmailParticipant
}

function appUrl() {
  return (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")
}

function personName(user: VisitEmailParticipant) {
  return `${user.firstName} ${user.lastName}`.trim() || "there"
}

function patientName(visit: VisitEmailPayload) {
  return `${visit.patient.firstName} ${visit.patient.lastName}`.trim()
}

function whenLabel(scheduledAt: Date) {
  return format(scheduledAt, "MMM d, yyyy 'at' h:mm a")
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
  const reason = visit.reason.trim() || "Video visit"
  const when = whenLabel(visit.scheduledAt)
  const patient = patientName(visit)

  await Promise.all([
    notifyVisitBookedInApp(visit),
    safeSend(`visit-booked doctor ${visit.id}`, () =>
      sendEmail(
        buildVisitBookedEmail({
          toName: personName(visit.provider),
          toEmail: visit.provider.email,
          patientName: patient,
          reason,
          whenLabel: when,
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
              patientName: patient,
              reason,
              whenLabel: when,
              portalUrl: nursePortalUrl(visit.id),
              recipientRole: "nurse",
            }),
          ),
        )
      : Promise.resolve(),
  ])
}

export async function notifyVisitReminder(visit: VisitEmailPayload) {
  const reason = visit.reason.trim() || "Video visit"
  const when = whenLabel(visit.scheduledAt)
  const patient = patientName(visit)

  await Promise.all([
    notifyVisitReminderInApp(visit),
    safeSend(`visit-reminder doctor ${visit.id}`, () =>
      sendEmail(
        buildVisitReminderEmail({
          toName: personName(visit.provider),
          toEmail: visit.provider.email,
          patientName: patient,
          reason,
          whenLabel: when,
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
              patientName: patient,
              reason,
              whenLabel: when,
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
  const reason = visit.reason.trim() || "Video visit"
  const when = whenLabel(visit.scheduledAt)
  const patient = patientName(visit)
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
            patientName: patient,
            reason,
            whenLabel: when,
            statusLabel,
            portalUrl: item.portalUrl,
          }),
        ),
      ),
    ),
  ])
}
