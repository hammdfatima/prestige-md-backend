import { VisitStatus } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { notifyVisitReminder } from "~/lib/emails/visit-notifications";
import logger from "~/lib/logger";

const REMINDER_WINDOW_MS = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS = 60_000;

let reminderTimer: NodeJS.Timeout | null = null;

async function sendUpcomingVisitReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const visits = await prisma.visit.findMany({
    where: {
      status: { in: [VisitStatus.IN_QUEUE, VisitStatus.IN_PROGRESS] },
      reminderSentAt: null,
      scheduledAt: {
        gt: now,
        lte: windowEnd,
      },
    },
    include: {
      patient: { select: { firstName: true, lastName: true, facilityId: true } },
      provider: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      bookedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  for (const visit of visits) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { reminderSentAt: new Date() },
    });

    await notifyVisitReminder({
      id: visit.id,
      reason: visit.reason,
      scheduledAt: visit.scheduledAt,
      status: visit.status,
      facilityId: visit.patient.facilityId,
      patient: {
        firstName: visit.patient.firstName,
        lastName: visit.patient.lastName,
      },
      provider: visit.provider,
      bookedBy: visit.bookedBy,
    });
  }

  if (visits.length > 0) {
    logger.info(`Sent reminders for ${visits.length} visit(s)`);
  }
}

export function startVisitReminderJob() {
  if (reminderTimer) {
    return;
  }

  const tick = () => {
    void sendUpcomingVisitReminders().catch((error) => {
      logger.error(error);
    });
  };

  tick();
  reminderTimer = setInterval(tick, REMINDER_INTERVAL_MS);
  logger.info("Visit reminder job started (every 60s, 30m window)");
}
