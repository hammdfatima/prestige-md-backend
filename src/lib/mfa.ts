/** HIPAA §1.2 multi-factor authentication — email OTP at login. */
import env from "~/env";

/** MFA is mandatory for staff when enabled — there is no per-user opt-out. */
export function isMfaEnabled(): boolean {
  return env.MFA_ENABLED;
}

export const LOGIN_MFA_OTP_TTL_MS = 10 * 60 * 1000;
export const LOGIN_MFA_MAX_ATTEMPTS = 5;
export const LOGIN_MFA_CODE_LENGTH = 4;
