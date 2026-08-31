/** HIPAA §7.2 automatic idle logoff — 15-minute timeout for ePHI sessions. */
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function isSessionIdleExpired(
  lastActiveAt: number | undefined,
  now = Date.now(),
  /** JWT `iat` (seconds) — fallback for tokens issued before idle tracking. */
  issuedAtSeconds?: number,
): boolean {
  const reference =
    lastActiveAt ??
    (issuedAtSeconds != null ? issuedAtSeconds * 1000 : undefined);

  if (reference == null || !Number.isFinite(reference)) {
    return true;
  }

  return now - reference > SESSION_IDLE_TIMEOUT_MS;
}
