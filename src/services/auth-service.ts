import { randomInt } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus } from "~/generated/prisma/client";
import { hashedPass, comparePassword } from "~/lib/bycrpt";
import prisma from "~/lib/db";
import { buildPasswordResetOtpEmail } from "~/lib/emails/templates";
import {
  readInviteType,
  verifyFacilityInviteToken,
  verifyStaffInviteToken,
} from "~/lib/facility-invite";
import { createToken } from "~/lib/jwt";
import logger from "~/lib/logger";
import { sendEmail } from "~/lib/mailer";
import { normalizeTeamPermissions } from "~/lib/permissions";
import { HttpError } from "~/middlewares/error-handler";
import { publicFacilityAccount } from "~/services/me-service";
import type {
  CreateAdminBody,
  ForgotPasswordBody,
  LoginBody,
  ResetPasswordBody,
  SetFacilityPasswordBody,
} from "~/schemas/auth-schemas";

const OTP_TTL_MS = 10 * 60 * 1000;

function publicUser<T extends { passwordHash?: string | null; permissions?: string[] }>(
  user: T,
) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  if (!("permissions" in safeUser) || !Array.isArray(safeUser.permissions)) {
    return safeUser;
  }
  return {
    ...safeUser,
    permissions: normalizeTeamPermissions(safeUser.permissions),
  };
}

function generateOtp() {
  return randomInt(1000, 10000).toString();
}

function inviteError() {
  return new HttpError(
    "This invite link is invalid or has expired",
    HttpStatus.BAD_REQUEST,
  );
}

async function getFacilityFromInvite(token: string) {
  let invite: { facilityId: string; email: string };
  try {
    invite = verifyFacilityInviteToken(token);
  } catch {
    throw inviteError();
  }

  const facility = await prisma.facility.findUnique({
    where: { id: invite.facilityId },
  });

  if (!facility || facility.email !== invite.email) {
    throw inviteError();
  }

  if (facility.status !== UserStatus.ACTIVE) {
    throw new HttpError("This facility is inactive", HttpStatus.FORBIDDEN);
  }

  return facility;
}

export async function login(input: LoginBody) {
  const { email, password } = input;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    if (
      !user.passwordHash ||
      !comparePassword({ password, hash: user.passwordHash })
    ) {
      throw new HttpError("Invalid email or password", HttpStatus.UNAUTHORIZED);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new HttpError("This account is inactive", HttpStatus.FORBIDDEN);
    }

    const token = createToken(
      { id: user.id, role: user.role },
      "24h",
    );

    return {
      token,
      user: publicUser(user),
    };
  }

  const facility = await prisma.facility.findUnique({
    where: { email: normalizedEmail },
  });

  if (
    !facility?.passwordHash ||
    !comparePassword({ password, hash: facility.passwordHash })
  ) {
    throw new HttpError("Invalid email or password", HttpStatus.UNAUTHORIZED);
  }

  if (facility.status !== UserStatus.ACTIVE) {
    throw new HttpError("This account is inactive", HttpStatus.FORBIDDEN);
  }

  const token = createToken(
    { id: facility.id, role: UserRole.FACILITY_MANAGER },
    "24h",
  );

  return {
    token,
    user: publicFacilityAccount(facility),
  };
}

async function getStaffFromInvite(token: string) {
  let invite: { userId: string; email: string };
  try {
    invite = verifyStaffInviteToken(token);
  } catch {
    throw inviteError();
  }

  const user = await prisma.user.findUnique({
    where: { id: invite.userId },
    include: { facility: true },
  });

  if (!user || user.email !== invite.email) {
    throw inviteError();
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError("This account is inactive", HttpStatus.FORBIDDEN);
  }

  return user;
}

export async function getFacilityInvite(token: string) {
  let type: ReturnType<typeof readInviteType>;
  try {
    type = readInviteType(token);
  } catch {
    throw inviteError();
  }

  if (type === "staff_invite") {
    const user = await getStaffFromInvite(token);
    return {
      facilityName: user.facility?.name ?? "PrestigeMD",
      managerName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
    };
  }

  const facility = await getFacilityFromInvite(token);
  return {
    facilityName: facility.name,
    managerName: facility.managerName,
    email: facility.email,
  };
}

export async function setFacilityPassword(input: SetFacilityPasswordBody) {
  let type: ReturnType<typeof readInviteType>;
  try {
    type = readInviteType(input.token);
  } catch {
    throw inviteError();
  }

  if (type === "staff_invite") {
    const user = await getStaffFromInvite(input.token);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPass(input.password),
        passwordSetAt: new Date(),
      },
    });

    return {
      token: createToken({ id: updated.id, role: updated.role }, "24h"),
      user: publicUser(updated),
    };
  }

  const facility = await getFacilityFromInvite(input.token);

  const updated = await prisma.facility.update({
    where: { id: facility.id },
    data: {
      passwordHash: hashedPass(input.password),
      passwordSetAt: new Date(),
    },
  });

  const sessionToken = createToken(
    { id: updated.id, role: UserRole.FACILITY_MANAGER },
    "24h",
  );

  return {
    token: sessionToken,
    user: publicFacilityAccount(updated),
  };
}

export async function forgotPassword(input: ForgotPasswordBody) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === UserStatus.ACTIVE && user.passwordHash) {
    await prisma.emailOtp.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    await prisma.emailOtp.create({
      data: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const name = `${user.firstName} ${user.lastName}`.trim() || "there";
    const emailSent = await sendEmail(
      buildPasswordResetOtpEmail({
        name,
        email: user.email,
        code,
      }),
    );

    if (!emailSent && process.env.NODE_ENV !== "production") {
      logger.info(`Password reset OTP for ${email}: ${code}`);
    }
    return;
  }

  const facility = await prisma.facility.findUnique({ where: { email } });
  if (
    facility &&
    facility.status === UserStatus.ACTIVE &&
    facility.passwordHash
  ) {
    await prisma.emailOtp.updateMany({
      where: { facilityId: facility.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    await prisma.emailOtp.create({
      data: {
        facilityId: facility.id,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const emailSent = await sendEmail(
      buildPasswordResetOtpEmail({
        name: facility.managerName || "there",
        email: facility.email,
        code,
      }),
    );

    if (!emailSent && process.env.NODE_ENV !== "production") {
      logger.info(`Password reset OTP for facility ${email}: ${code}`);
    }
  }
}

export async function resetPassword(input: ResetPasswordBody) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === UserStatus.ACTIVE && user.passwordHash) {
    const otp = await prisma.emailOtp.findFirst({
      where: {
        userId: user.id,
        code: input.code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      throw new HttpError(
        "Invalid or expired reset code",
        HttpStatus.BAD_REQUEST,
      );
    }

    await prisma.$transaction([
      prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPass(input.password) },
      }),
    ]);
    return;
  }

  const facility = await prisma.facility.findUnique({ where: { email } });
  if (
    !facility ||
    facility.status !== UserStatus.ACTIVE ||
    !facility.passwordHash
  ) {
    throw new HttpError("Invalid or expired reset code", HttpStatus.BAD_REQUEST);
  }

  const otp = await prisma.emailOtp.findFirst({
    where: {
      facilityId: facility.id,
      code: input.code,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new HttpError("Invalid or expired reset code", HttpStatus.BAD_REQUEST);
  }

  await prisma.$transaction([
    prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.facility.update({
      where: { id: facility.id },
      data: { passwordHash: hashedPass(input.password) },
    }),
  ]);
}

export async function createAdmin(input: CreateAdminBody) {
  const { firstName, lastName, email, password, phone } = input;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new HttpError("Email is already in use", HttpStatus.CONFLICT);
  }

  const admin = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash: hashedPass(password),
      phone,
      role: UserRole.ADMIN,
    },
  });

  return publicUser(admin);
}
