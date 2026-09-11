export const FALLBACK_TIME_ZONE = "UTC";
export const IANA_TIMEZONE_MAX_LENGTH = 64;

export function isValidIanaTimeZone(value: string): boolean {
  if (!value || value.length > IANA_TIMEZONE_MAX_LENGTH) {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeIanaTimeZone(
  value?: string | null,
): string | null {
  const timezone = value?.trim();
  if (!timezone || !isValidIanaTimeZone(timezone)) {
    return null;
  }
  return timezone;
}

export function resolveTimeZone(value?: string | null): string {
  return normalizeIanaTimeZone(value) ?? FALLBACK_TIME_ZONE;
}

function formatParts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    ...options,
  }).format(date);
}

/** e.g. "Sep 11, 2026 at 2:30 PM EDT" */
export function formatWhenLabel(
  date: Date,
  timeZone?: string | null,
): string {
  const tz = resolveTimeZone(timeZone);
  const dateLabel = formatParts(date, tz, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = formatParts(date, tz, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return `${dateLabel} at ${timeLabel}`;
}

/** e.g. "Sep 11, 2026, 2:30 PM EDT" for login activity emails */
export function formatSignedInAtLabel(
  date: Date,
  timeZone?: string | null,
): string {
  return formatParts(date, resolveTimeZone(timeZone), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}
