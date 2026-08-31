/** HIPAA §1.3 account lockout — lock after repeated failed logins. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(lockedUntil: Date | null | undefined): boolean {
  return lockedUntil != null && lockedUntil > new Date();
}

export function lockoutExpiresAt(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}

export function lockoutMessage(lockedUntil: Date): string {
  const minutesRemaining = Math.max(
    1,
    Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000),
  );

  return `Account temporarily locked due to too many failed login attempts. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`;
}
