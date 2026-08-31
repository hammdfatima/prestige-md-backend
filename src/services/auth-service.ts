import { randomInt } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, OtpPurpose } from "~/generated/prisma/client";
import { hashedPass, comparePassword, needsRehash } from "~/lib/bycrpt";
import { storeNewPassword } from "~/lib/store-new-password";
import prisma from "~/lib/db";
import {
  facilityEmailWhere,
  userEmailWhere,
} from "~/lib/encryption-queries";
import {
  isAccountLocked,
  lockoutExpiresAt,
  lockoutMessage,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "~/lib/account-lockout";
import {
  ensureMinimumDuration,
  otpVerificationFailure,
  resetPasswordFailure,
  RESEND_LOGIN_OTP_MESSAGE,
  runConstantTimeWork,
} from "~/lib/anti-enumeration";
import { buildPasswordResetLinkEmail, buildLoginMfaOtpEmail } from "~/lib/emails/templates";
import { getAppBaseUrl } from "~/lib/app-url";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "~/lib/password-reset-token";
import {
  readInviteType,
  verifyFacilityInviteToken,
  verifyStaffInviteToken,
} from "~/lib/facility-invite";
import { issueSessionToken } from "~/lib/session-token";
import {
  invalidateFacilityCredentials,
  invalidateUserCredentials,
} from "~/services/session-revocation-service";
import { createAccountSession } from "~/services/account-session-service";
import {
  createLoginMfaChallengeToken,
  verifyLoginMfaChallengeToken,
} from "~/lib/login-mfa-challenge";
import {
  isMfaEnabled,
  LOGIN_MFA_CODE_LENGTH,
  LOGIN_MFA_MAX_ATTEMPTS,
  LOGIN_MFA_OTP_TTL_MS,
} from "~/lib/mfa";
import logger from "~/lib/logger";
import { sendEmail } from "~/lib/mailer";
import { normalizeTeamPermissions } from "~/lib/permissions";
import {
  recordAccountLockout,
  recordLoginFailed,
  recordLoginSuccess,
  recordMfaChallengeFailed,
  recordMfaChallengeIssued,
  recordMfaChallengePassed,
  recordPasswordResetCompleted,
  recordPasswordResetRequested,
  recordSignupCompleted,
  toAuthAccountRef,
} from "~/lib/auth-audit";
import { HttpError } from "~/middlewares/error-handler";
import { publicFacilityAccount } from "~/services/me-service";
import { recordLoginAndNotify } from "~/services/login-notification-service";
import type {
  ForgotPasswordBody,
  LoginBody,
  ResetPasswordBody,
  SetFacilityPasswordBody,
  VerifyLoginOtpBody,
} from "~/schemas/auth-schemas";
import type { Facility, User } from "~/generated/prisma/client";

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};

type LoginAccount =
  | {
      kind: "user";
      record: User;
    }
  | {
      kind: "facility";
      record: Facility;
    };

type ResettableAccount =
  | {
      kind: "user";
      id: string;
      email: string;
      name: string;
      role: UserRole;
    }
  | {
      kind: "facility";
      id: string;
      email: string;
      name: string;
    };

function resettableToAuthRef(account: ResettableAccount) {
  if (account.kind === "user") {
    return {
      kind: "user" as const,
      id: account.id,
      email: account.email,
      role: account.role,
    };
  }

  return {
    kind: "facility" as const,
    id: account.id,
    email: account.email,
    role: UserRole.FACILITY_MANAGER,
  };
}

function resolveResettableAccount(
  user: User | null,
  facility: Facility | null,
): ResettableAccount | null {
  if (user?.status === UserStatus.ACTIVE && user.passwordHash) {
    return {
      kind: "user",
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim() || "there",
      role: user.role,
    };
  }

  if (facility?.status === UserStatus.ACTIVE && facility.passwordHash) {
    return {
      kind: "facility",
      id: facility.id,
      email: facility.email,
      name: facility.managerName || "there",
    };
  }

  return null;
}

async function sendPasswordResetLink(account: ResettableAccount) {
  const accountKind = account.kind;
  const accountId = account.id;
  const { token, jti, expiresAt } = createPasswordResetToken({
    accountKind,
    accountId,
    email: account.email,
  });
  const resetUrl = `${getAppBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

  if (accountKind === "user") {
    await prisma.emailOtp.updateMany({
      where: {
        userId: accountId,
        purpose: OtpPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await prisma.emailOtp.create({
      data: {
        userId: accountId,
        code: jti,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt,
      },
    });
  } else {
    await prisma.emailOtp.updateMany({
      where: {
        facilityId: accountId,
        purpose: OtpPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await prisma.emailOtp.create({
      data: {
        facilityId: accountId,
        code: jti,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt,
      },
    });
  }

  await sendEmail(
    buildPasswordResetLinkEmail({
      name: account.name,
      email: account.email,
      resetUrl,
    }),
  );
}

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

function generateLoginMfaOtp() {
  const min = 10 ** (LOGIN_MFA_CODE_LENGTH - 1);
  const max = 10 ** LOGIN_MFA_CODE_LENGTH;
  return randomInt(min, max).toString();
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

async function findLoginAccount(email: string): Promise<LoginAccount | null> {
  const user = await prisma.user.findUnique({
    where: userEmailWhere(email),
  });

  if (user?.passwordHash) {
    return { kind: "user", record: user };
  }

  const facility = await prisma.facility.findUnique({
    where: facilityEmailWhere(email),
  });

  if (facility?.passwordHash) {
    return { kind: "facility", record: facility };
  }

  return null;
}

async function clearExpiredLockout(account: LoginAccount) {
  if (!account.record.lockedUntil || isAccountLocked(account.record.lockedUntil)) {
    return;
  }

  if (account.kind === "user") {
    await prisma.user.update({
      where: { id: account.record.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  } else {
    await prisma.facility.update({
      where: { id: account.record.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  account.record.failedLoginAttempts = 0;
  account.record.lockedUntil = null;
}

async function resetFailedLoginAttempts(account: LoginAccount) {
  if (
    account.record.failedLoginAttempts === 0 &&
    account.record.lockedUntil == null
  ) {
    return;
  }

  if (account.kind === "user") {
    await prisma.user.update({
      where: { id: account.record.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  } else {
    await prisma.facility.update({
      where: { id: account.record.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}

async function handleFailedLogin(account: LoginAccount, ctx: LoginContext) {
  const accountRef = toAuthAccountRef(account);
  recordLoginFailed(account.record.email, accountRef, ctx);

  const nextAttempts = account.record.failedLoginAttempts + 1;
  const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
  const lockedUntil = shouldLock ? lockoutExpiresAt() : null;

  if (account.kind === "user") {
    await prisma.user.update({
      where: { id: account.record.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil,
      },
    });
  } else {
    await prisma.facility.update({
      where: { id: account.record.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil,
      },
    });
  }

  if (shouldLock && lockedUntil) {
    recordAccountLockout(accountRef, ctx);

    throw new HttpError(lockoutMessage(lockedUntil), HttpStatus.TOO_MANY_REQUESTS);
  }

  throw new HttpError("Invalid email or password", HttpStatus.UNAUTHORIZED);
}

function getAccountDisplayName(account: LoginAccount): string {
  if (account.kind === "user") {
    const name =
      `${account.record.firstName} ${account.record.lastName}`.trim();
    return name || "there";
  }

  return account.record.managerName || "there";
}

async function maybeRehashPassword(account: LoginAccount, password: string) {
  if (account.kind === "user") {
    if (!needsRehash(account.record.passwordHash as string)) {
      return;
    }

    await prisma.user.update({
      where: { id: account.record.id },
      data: { passwordHash: await hashedPass(password) },
    });
    return;
  }

  if (!needsRehash(account.record.passwordHash as string)) {
    return;
  }

  await prisma.facility.update({
    where: { id: account.record.id },
    data: { passwordHash: await hashedPass(password) },
  });
}

async function issueLoginSession(
  account: LoginAccount,
  ctx: LoginContext = {},
) {
  if (account.kind === "user") {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.record.id },
      select: { id: true, role: true, tokenVersion: true },
    });
    const session = await createAccountSession(
      { id: user.id, role: user.role },
      { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
    );
    const token = issueSessionToken({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: session.id,
    });

    return {
      token,
      user: publicUser(account.record),
    };
  }

  const facility = await prisma.facility.findUniqueOrThrow({
    where: { id: account.record.id },
    select: { id: true, tokenVersion: true },
  });
  const session = await createAccountSession(
    { id: facility.id, role: UserRole.FACILITY_MANAGER },
    { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
  );
  const token = issueSessionToken({
    id: facility.id,
    role: UserRole.FACILITY_MANAGER,
    tokenVersion: facility.tokenVersion,
    sessionId: session.id,
  });

  return {
    token,
    user: publicFacilityAccount(account.record),
  };
}

async function completeLogin(account: LoginAccount, ctx: LoginContext = {}) {
  const session = await issueLoginSession(account, ctx);
  recordLoginSuccess(toAuthAccountRef(account), ctx);

  void recordLoginAndNotify(account, ctx).catch((error) => {
    logger.error("Failed to send login activity notification");
    logger.error(error);
  });

  return session;
}

async function invalidateLoginMfaOtps(account: LoginAccount) {
  if (account.kind === "user") {
    await prisma.emailOtp.updateMany({
      where: {
        userId: account.record.id,
        purpose: OtpPurpose.LOGIN_MFA,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    return;
  }

  await prisma.emailOtp.updateMany({
    where: {
      facilityId: account.record.id,
      purpose: OtpPurpose.LOGIN_MFA,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });
}

async function createAndSendLoginMfaOtp(account: LoginAccount) {
  await invalidateLoginMfaOtps(account);

  const code = generateLoginMfaOtp();
  const expiresAt = new Date(Date.now() + LOGIN_MFA_OTP_TTL_MS);

  if (account.kind === "user") {
    await prisma.emailOtp.create({
      data: {
        userId: account.record.id,
        code,
        purpose: OtpPurpose.LOGIN_MFA,
        expiresAt,
      },
    });
  } else {
    await prisma.emailOtp.create({
      data: {
        facilityId: account.record.id,
        code,
        purpose: OtpPurpose.LOGIN_MFA,
        expiresAt,
      },
    });
  }

  const emailSent = await sendEmail(
    buildLoginMfaOtpEmail({
      name: getAccountDisplayName(account),
      email: account.record.email,
      code,
    }),
  );

  if (!emailSent) {
    logger.warn(
      `Login MFA email not delivered for account ${account.record.id}`,
    );
  }
}

async function startLoginMfa(account: LoginAccount, ctx: LoginContext = {}) {
  await createAndSendLoginMfaOtp(account);
  recordMfaChallengeIssued(toAuthAccountRef(account), ctx);

  const challengeToken = createLoginMfaChallengeToken({
    accountKind: account.kind,
    accountId: account.record.id,
    email: account.record.email,
  });

  return {
    mfaRequired: true as const,
    challengeToken,
    email: account.record.email,
  };
}

async function findLoginAccountByChallenge(
  challenge: ReturnType<typeof verifyLoginMfaChallengeToken>,
): Promise<LoginAccount | null> {
  if (challenge.accountKind === "user") {
    const user = await prisma.user.findUnique({
      where: { id: challenge.accountId },
    });

    if (!user?.passwordHash || user.email !== challenge.email) {
      return null;
    }

    return { kind: "user", record: user };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: challenge.accountId },
  });

  if (!facility?.passwordHash || facility.email !== challenge.email) {
    return null;
  }

  return { kind: "facility", record: facility };
}

async function findActiveLoginMfaOtp(account: LoginAccount) {
  return prisma.emailOtp.findFirst({
    where: {
      purpose: OtpPurpose.LOGIN_MFA,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      userId: account.kind === "user" ? account.record.id : undefined,
      facilityId: account.kind === "facility" ? account.record.id : undefined,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function login(input: LoginBody, ctx: LoginContext = {}) {
  const { email, password } = input;
  const normalizedEmail = email.toLowerCase();
  const account = await findLoginAccount(normalizedEmail);

  if (!account) {
    recordLoginFailed(normalizedEmail, null, ctx);
    throw new HttpError("Invalid email or password", HttpStatus.UNAUTHORIZED);
  }

  await clearExpiredLockout(account);

  if (isAccountLocked(account.record.lockedUntil)) {
    recordLoginFailed(
      normalizedEmail,
      toAuthAccountRef(account),
      ctx,
    );
    throw new HttpError(
      lockoutMessage(account.record.lockedUntil as Date),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const passwordValid = await comparePassword({
    password,
    hash: account.record.passwordHash as string,
  });

  if (!passwordValid) {
    await handleFailedLogin(account, ctx);
  }

  if (account.record.status !== UserStatus.ACTIVE) {
    throw new HttpError("This account is inactive", HttpStatus.FORBIDDEN);
  }

  await resetFailedLoginAttempts(account);
  await maybeRehashPassword(account, password);

  if (isMfaEnabled()) {
    return startLoginMfa(account, ctx);
  }

  return {
    mfaRequired: false as const,
    ...(await completeLogin(account, ctx)),
  };
}

export async function verifyLoginOtp(
  input: VerifyLoginOtpBody,
  ctx: LoginContext = {},
) {
  const startedAt = Date.now();

  let challenge: ReturnType<typeof verifyLoginMfaChallengeToken>;
  try {
    challenge = verifyLoginMfaChallengeToken(input.challengeToken);
  } catch {
    await runConstantTimeWork();
    await ensureMinimumDuration(startedAt);
    throw otpVerificationFailure();
  }

  const account = await findLoginAccountByChallenge(challenge);

  if (!account || account.record.status !== UserStatus.ACTIVE) {
    await runConstantTimeWork();
    await ensureMinimumDuration(startedAt);
    throw otpVerificationFailure();
  }

  const otp = await findActiveLoginMfaOtp(account);

  if (!otp || otp.failedAttempts >= LOGIN_MFA_MAX_ATTEMPTS) {
    if (otp) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
    }

    await runConstantTimeWork();
    await ensureMinimumDuration(startedAt);
    throw otpVerificationFailure();
  }

  if (otp.code !== input.code) {
    const nextAttempts = otp.failedAttempts + 1;
    const shouldInvalidate = nextAttempts >= LOGIN_MFA_MAX_ATTEMPTS;

    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: {
        failedAttempts: nextAttempts,
        ...(shouldInvalidate ? { consumedAt: new Date() } : {}),
      },
    });

    recordMfaChallengeFailed(toAuthAccountRef(account), ctx);

    await runConstantTimeWork();
    await ensureMinimumDuration(startedAt);
    throw otpVerificationFailure();
  }

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  recordMfaChallengePassed(toAuthAccountRef(account), ctx);

  return completeLogin(account, ctx);
}

export async function resendLoginOtp(
  input: { challengeToken: string },
  ctx: LoginContext = {},
) {
  const startedAt = Date.now();

  try {
    const challenge = verifyLoginMfaChallengeToken(input.challengeToken);
    const account = await findLoginAccountByChallenge(challenge);

    if (account && account.record.status === UserStatus.ACTIVE) {
      await createAndSendLoginMfaOtp(account);
      recordMfaChallengeIssued(toAuthAccountRef(account), ctx);
    } else {
      await runConstantTimeWork();
    }
  } catch {
    await runConstantTimeWork();
  }

  await ensureMinimumDuration(startedAt);

  return {
    message: RESEND_LOGIN_OTP_MESSAGE,
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

export async function setFacilityPassword(
  input: SetFacilityPasswordBody,
  ctx: LoginContext = {},
) {
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
        passwordHash: await storeNewPassword(input.password),
        passwordSetAt: new Date(),
      },
    });

    const account = { kind: "user" as const, record: updated };
    recordSignupCompleted(toAuthAccountRef(account), ctx);
    return completeLogin(account, ctx);
  }

  const facility = await getFacilityFromInvite(input.token);

  const updated = await prisma.facility.update({
    where: { id: facility.id },
    data: {
      passwordHash: await storeNewPassword(input.password),
      passwordSetAt: new Date(),
    },
  });

  const facilityAccount = { kind: "facility" as const, record: updated };
  recordSignupCompleted(toAuthAccountRef(facilityAccount), ctx);
  return completeLogin(facilityAccount, ctx);
}

export async function forgotPassword(
  input: ForgotPasswordBody,
  ctx: LoginContext = {},
) {
  const startedAt = Date.now();
  const email = input.email.toLowerCase();

  const [user, facility] = await Promise.all([
    prisma.user.findUnique({ where: userEmailWhere(email) }),
    prisma.facility.findUnique({ where: facilityEmailWhere(email) }),
  ]);

  const account = resolveResettableAccount(user, facility);

  if (account) {
    recordPasswordResetRequested(resettableToAuthRef(account), ctx);
    await sendPasswordResetLink(account);
  } else {
    await runConstantTimeWork();
  }

  await ensureMinimumDuration(startedAt);
}

async function tryResetPassword(
  input: ResetPasswordBody,
): Promise<ResettableAccount | null> {
  let tokenPayload: ReturnType<typeof verifyPasswordResetToken>;
  try {
    tokenPayload = verifyPasswordResetToken(input.token);
  } catch {
    return null;
  }

  const otp = await prisma.emailOtp.findFirst({
    where: {
      purpose: OtpPurpose.PASSWORD_RESET,
      code: tokenPayload.jti,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      userId:
        tokenPayload.accountKind === "user" ? tokenPayload.accountId : undefined,
      facilityId:
        tokenPayload.accountKind === "facility"
          ? tokenPayload.accountId
          : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return null;
  }

  const [user, facility] = await Promise.all([
    tokenPayload.accountKind === "user"
      ? prisma.user.findUnique({ where: { id: tokenPayload.accountId } })
      : Promise.resolve(null),
    tokenPayload.accountKind === "facility"
      ? prisma.facility.findUnique({ where: { id: tokenPayload.accountId } })
      : Promise.resolve(null),
  ]);

  const account = resolveResettableAccount(user, facility);
  if (!account || account.email !== tokenPayload.email) {
    return null;
  }

  if (account.kind === "user") {
    await prisma.$transaction([
      prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: account.id },
        data: { passwordHash: await storeNewPassword(input.password) },
      }),
    ]);
    return account;
  }

  await prisma.$transaction([
    prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.facility.update({
      where: { id: account.id },
      data: { passwordHash: await storeNewPassword(input.password) },
    }),
  ]);

  return account;
}

export async function resetPassword(
  input: ResetPasswordBody,
  ctx: LoginContext = {},
) {
  const startedAt = Date.now();
  const account = await tryResetPassword(input);

  if (!account) {
    await runConstantTimeWork();
    await ensureMinimumDuration(startedAt);
    throw resetPasswordFailure();
  }

  recordPasswordResetCompleted(resettableToAuthRef(account), ctx);

  if (account.kind === "user") {
    await invalidateUserCredentials(account.id, account.role);
  } else {
    await invalidateFacilityCredentials(account.id);
  }

  await ensureMinimumDuration(startedAt);
}
