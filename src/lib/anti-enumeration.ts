/** HIPAA §1.4 anti-enumeration — equalized timing and generic auth errors. */
import { status as HttpStatus } from "http-status";
import { hashedPass } from "~/lib/bycrpt";
import { HttpError } from "~/middlewares/error-handler";

/** Minimum wall-clock time for auth flows that must not leak account existence via timing. */
export const MIN_AUTH_FLOW_DURATION_MS = 450;

export const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for this email, a password reset link has been sent";

export const RESET_PASSWORD_FAILURE_MESSAGE =
  "Unable to reset password. Check your email and code, then try again.";

export const OTP_VERIFICATION_FAILURE_MESSAGE =
  "Unable to verify the code. Please try again or sign in again.";

export const RESEND_LOGIN_OTP_MESSAGE =
  "If a sign-in is in progress, a new verification code was sent to your email";

export function resetPasswordFailure(): HttpError {
  return new HttpError(
    RESET_PASSWORD_FAILURE_MESSAGE,
    HttpStatus.BAD_REQUEST,
  );
}

export function otpVerificationFailure(): HttpError {
  return new HttpError(
    OTP_VERIFICATION_FAILURE_MESSAGE,
    HttpStatus.BAD_REQUEST,
  );
}

export async function ensureMinimumDuration(
  startedAt: number,
  minimumMs = MIN_AUTH_FLOW_DURATION_MS,
): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/** Burns roughly the same CPU time as a real password hash to reduce timing leaks. */
export async function runConstantTimeWork(): Promise<void> {
  await hashedPass("ConstantTimeDummy1!");
}
