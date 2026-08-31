import { getAppBaseUrl } from "~/lib/app-url";
import prisma from "~/lib/db";
import { buildLoginActivityEmail } from "~/lib/emails/templates";
import {
  createReportToken,
  describeUserAgent,
  formatLoginLocation,
  getDeviceFingerprint,
} from "~/lib/login-device";
import logger from "~/lib/logger";
import { sendEmail } from "~/lib/mailer";
import { HttpError } from "~/middlewares/error-handler";
import { status as HttpStatus } from "http-status";
import type {
  LoginAccountRef,
  LoginNotificationContext,
} from "~/services/login-notification-types";

const REPORT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getAccountName(account: LoginAccountRef): string {
  if (account.kind === "user") {
    const name =
      `${account.record.firstName} ${account.record.lastName}`.trim();
    return name || "there";
  }

  return account.record.managerName || "there";
}

function getAppUrl() {
  return getAppBaseUrl();
}

async function registerKnownDevice(
  account: LoginAccountRef,
  deviceFingerprint: string,
  deviceLabel: string,
): Promise<boolean> {
  if (account.kind === "user") {
    const existing = await prisma.knownLoginDevice.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId: account.record.id,
          deviceFingerprint,
        },
      },
    });

    if (existing) {
      await prisma.knownLoginDevice.update({
        where: { id: existing.id },
        data: { deviceLabel, lastSeenAt: new Date() },
      });
      return false;
    }

    await prisma.knownLoginDevice.create({
      data: {
        userId: account.record.id,
        deviceFingerprint,
        deviceLabel,
      },
    });
    return true;
  }

  const existing = await prisma.knownLoginDevice.findUnique({
    where: {
      facilityId_deviceFingerprint: {
        facilityId: account.record.id,
        deviceFingerprint,
      },
    },
  });

  if (existing) {
    await prisma.knownLoginDevice.update({
      where: { id: existing.id },
      data: { deviceLabel, lastSeenAt: new Date() },
    });
    return false;
  }

  await prisma.knownLoginDevice.create({
    data: {
      facilityId: account.record.id,
      deviceFingerprint,
      deviceLabel,
    },
  });

  return true;
}

export async function recordLoginAndNotify(
  account: LoginAccountRef,
  ctx: LoginNotificationContext,
) {
  const deviceFingerprint = getDeviceFingerprint(ctx.userAgent);
  const deviceLabel = describeUserAgent(ctx.userAgent);
  const isNewDevice = await registerKnownDevice(
    account,
    deviceFingerprint,
    deviceLabel,
  );
  const reportToken = createReportToken();
  const signedInAt = new Date();

  await prisma.loginActivity.create({
    data: {
      userId: account.kind === "user" ? account.record.id : undefined,
      facilityId: account.kind === "facility" ? account.record.id : undefined,
      deviceFingerprint,
      deviceLabel,
      ipAddress: ctx.ipAddress,
      isNewDevice,
      reportToken,
      reportTokenExpiresAt: new Date(Date.now() + REPORT_TOKEN_TTL_MS),
    },
  });

  const reportUrl = `${getAppUrl()}/auth/report-login?token=${encodeURIComponent(reportToken)}`;
  const emailSent = await sendEmail(
    buildLoginActivityEmail({
      name: getAccountName(account),
      email: account.record.email,
      deviceLabel,
      locationLabel: formatLoginLocation(ctx.ipAddress),
      signedInAtLabel: signedInAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      isNewDevice,
      reportUrl,
    }),
  );

  if (!emailSent) {
    logger.warn(
      `Login activity email not delivered for account ${account.record.id}`,
    );
  }
}

export async function reportSuspiciousLogin(reportToken: string) {
  const activity = await prisma.loginActivity.findUnique({
    where: { reportToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          status: true,
          passwordHash: true,
        },
      },
      facility: {
        select: {
          id: true,
          email: true,
          status: true,
          passwordHash: true,
        },
      },
    },
  });

  if (
    !activity ||
    activity.reportedAt ||
    activity.reportTokenExpiresAt <= new Date()
  ) {
    throw new HttpError(
      "This security link is invalid or has expired.",
      HttpStatus.BAD_REQUEST,
    );
  }

  const accountEmail = activity.user?.email ?? activity.facility?.email;
  if (!accountEmail) {
    throw new HttpError(
      "This security link is invalid or has expired.",
      HttpStatus.BAD_REQUEST,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.loginActivity.update({
      where: { id: activity.id },
      data: { reportedAt: new Date() },
    });

    if (activity.userId) {
      await tx.user.update({
        where: { id: activity.userId },
        data: {
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.accountSession.updateMany({
        where: { userId: activity.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }

    if (activity.facilityId) {
      await tx.facility.update({
        where: { id: activity.facilityId },
        data: {
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.accountSession.updateMany({
        where: { facilityId: activity.facilityId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  const { forgotPassword } = await import("~/services/auth-service");
  await forgotPassword({ email: accountEmail });

  return {
    email: accountEmail,
  };
}
