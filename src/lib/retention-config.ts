/** HIPAA §6.1 clinical record retention — default minimum before destruction. */
export const CLINICAL_RETENTION_YEARS = 6;

export const CLINICAL_RETENTION_MS =
  CLINICAL_RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

/** OTPs, step-up tokens, and other short-lived auth artifacts. */
export const SHORT_LIVED_SECRET_RETENTION_DAYS = 30;

export const SHORT_LIVED_SECRET_RETENTION_MS =
  SHORT_LIVED_SECRET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type RetentionJobMode = "dry_run" | "live";

export type RetentionJobReport = {
  mode: RetentionJobMode;
  ranAt: string;
  evaluatedPatients: number;
  patientsAnonymized: number;
  patientsHardDeleted: number;
  shortLivedSecretsPurged: number;
  patientsAnonymizeCandidates: string[];
  patientsHardDeleteCandidates: string[];
};
