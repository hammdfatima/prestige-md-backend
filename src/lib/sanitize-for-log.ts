/** HIPAA §8.2 / §17.1 — redact secrets and PHI from logs by default. */
const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "oldpassword",
  "authorization",
  "cookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "stepuptoken",
  "challengetoken",
  "reporttoken",
  "invite",
  "code",
  "otp",
  "ssn",
  "dateofbirth",
  "dob",
  "phonenumber",
  "phone",
  "email",
  "firstname",
  "lastname",
  "patientname",
  "reason",
  "insurancememberid",
  "insurancegroupnumber",
  "medicalrecordnumber",
  "mrn",
]);

const REDACTED = "[REDACTED]";

const SENSITIVE_URL_PARAMS =
  /([?&](?:token|stepUpToken|code|password|otp|reportToken|invite)=)[^&\s]+/gi;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return value.replace(SENSITIVE_URL_PARAMS, `$1${REDACTED}`);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item !== null
        ? sanitizeForLog(item)
        : typeof item === "string"
          ? item.replace(SENSITIVE_URL_PARAMS, `$1${REDACTED}`)
          : item,
    );
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeForLog(value as Record<string, unknown>);
  }

  return value;
}

/** Strip sensitive fields before logging request bodies, errors, or metadata. */
export function sanitizeForLog<T extends Record<string, unknown>>(value: T): T {
  const sanitized = { ...value };

  for (const [key, entry] of Object.entries(sanitized)) {
    sanitized[key as keyof T] = redactValue(key, entry) as T[keyof T];
  }

  return sanitized;
}

export function sanitizeLogMessage(message: unknown): string {
  if (message === null || message === undefined) {
    return String(message);
  }

  if (typeof message === "string") {
    return message.replace(SENSITIVE_URL_PARAMS, `$1${REDACTED}`);
  }

  if (message instanceof Error) {
    const stack = message.stack ?? message.message;
    return stack.replace(SENSITIVE_URL_PARAMS, `$1${REDACTED}`);
  }

  if (typeof message === "object") {
    try {
      return JSON.stringify(sanitizeForLog(message as Record<string, unknown>));
    } catch {
      return "[Unserializable log payload]";
    }
  }

  return String(message).replace(SENSITIVE_URL_PARAMS, `$1${REDACTED}`);
}
