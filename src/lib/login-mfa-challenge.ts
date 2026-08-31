import jwt, { type SignOptions } from "jsonwebtoken";
import env from "~/env";
import { LOGIN_MFA_OTP_TTL_MS } from "~/lib/mfa";
import { HttpError } from "~/middlewares/error-handler";
import { status as HttpStatus } from "http-status";

export type LoginMfaChallengePayload = {
  purpose: "login_mfa";
  accountKind: "user" | "facility";
  accountId: string;
  email: string;
};

export function createLoginMfaChallengeToken(
  payload: Omit<LoginMfaChallengePayload, "purpose">,
): string {
  const challenge: LoginMfaChallengePayload = {
    ...payload,
    purpose: "login_mfa",
  };

  return jwt.sign(challenge, env.JWT_SECRET, {
    expiresIn: Math.floor(LOGIN_MFA_OTP_TTL_MS / 1000) as SignOptions["expiresIn"],
  });
}

export function verifyLoginMfaChallengeToken(
  token: string,
): LoginMfaChallengePayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as LoginMfaChallengePayload;

    if (
      payload.purpose !== "login_mfa" ||
      !payload.accountId ||
      !payload.email ||
      (payload.accountKind !== "user" && payload.accountKind !== "facility")
    ) {
      throw new Error("Invalid MFA challenge");
    }

    return payload;
  } catch {
    throw new HttpError(
      "Your login session expired. Please sign in again.",
      HttpStatus.BAD_REQUEST,
    );
  }
}
