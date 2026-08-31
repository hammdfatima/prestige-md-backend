import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import env from "~/env";

const PASSWORD_RESET_TYPE = "password_reset";
const PASSWORD_RESET_TTL_SECONDS = 10 * 60;

export type PasswordResetAccountKind = "user" | "facility";

export type PasswordResetTokenPayload = {
  type: typeof PASSWORD_RESET_TYPE;
  accountKind: PasswordResetAccountKind;
  accountId: string;
  email: string;
  jti: string;
};

export function createPasswordResetToken(input: {
  accountKind: PasswordResetAccountKind;
  accountId: string;
  email: string;
}) {
  const jti = randomBytes(32).toString("hex");
  const token = jwt.sign(
    {
      type: PASSWORD_RESET_TYPE,
      accountKind: input.accountKind,
      accountId: input.accountId,
      email: input.email.toLowerCase(),
      jti,
    } satisfies PasswordResetTokenPayload,
    env.JWT_SECRET,
    { expiresIn: PASSWORD_RESET_TTL_SECONDS },
  );

  return { token, jti, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000) };
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload &
    Partial<PasswordResetTokenPayload>;

  if (
    payload.type !== PASSWORD_RESET_TYPE ||
    (payload.accountKind !== "user" && payload.accountKind !== "facility") ||
    typeof payload.accountId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid password reset token");
  }

  return {
    type: PASSWORD_RESET_TYPE,
    accountKind: payload.accountKind,
    accountId: payload.accountId,
    email: payload.email.toLowerCase(),
    jti: payload.jti,
  };
}
