/** HIPAA §6.1 audit log retention — keep security audit events at least 6 years. */
export const SECURITY_AUDIT_RETENTION_YEARS = 6;

export const SECURITY_AUDIT_RETENTION_MS =
  SECURITY_AUDIT_RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;
