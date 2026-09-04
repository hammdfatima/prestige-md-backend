export const USER_ENCRYPTED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "employeeId",
  "specialty",
  "medicalLicense",
  "education",
  "yearsExperience",
  "primaryLanguage",
  "availability",
] as const;

export const FACILITY_ENCRYPTED_FIELDS = [
  "name",
  "managerName",
  "email",
  "location",
  "phone",
] as const;

export const PATIENT_ENCRYPTED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "memberId",
  "dateOfBirth",
  "authorizedRepresentative",
  "decisionMaker",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  "nextOfKinEmail",
  "nextOfKinAddress",
  "insuranceProvider",
  "insurancePlanName",
  "insurancePlanType",
  "insuranceMemberId",
  "insuranceGroupNumber",
  "insuranceSubscriberName",
  "insuranceSubscriberRelationship",
  "insuranceEffectiveDate",
  "insurancePhone",
  "knownAllergies",
  "medicalHistory",
  "height",
  "weight",
  "physicalOrSensoryLimitations",
  "cognitiveOrBehavioralStatus",
  "nursingTreatmentRequirements",
  "specialPrecautions",
  "specialDietOther",
  "currentMedications",
  "additionalComments",
  "examinerName",
  "examinerLicenseNumber",
  "examinerPhone",
  "examinerAddress",
  "examinationDate",
  "nurseNotes",
] as const;

export const PATIENT_MEDICATION_ENCRYPTED_FIELDS = [
  "name",
  "dosage",
  "frequency",
  "instructions",
] as const;

export const VISIT_ENCRYPTED_FIELDS = [
  "reason",
  "progressNotes",
  "soapSubjective",
  "soapObjective",
  "soapAssessment",
  "soapPlan",
] as const;

export const VISIT_MESSAGE_ENCRYPTED_FIELDS = [
  "body",
  "attachmentUrl",
  "attachmentFilename",
  "attachmentMimeType",
] as const;

export const EMAIL_OTP_ENCRYPTED_FIELDS = ["code"] as const;

export const LOGIN_ACTIVITY_ENCRYPTED_FIELDS = ["deviceLabel", "ipAddress"] as const;

export const ACCOUNT_SESSION_ENCRYPTED_FIELDS = [
  "deviceLabel",
  "ipAddress",
  "userAgent",
] as const;

export const KNOWN_LOGIN_DEVICE_ENCRYPTED_FIELDS = ["deviceLabel"] as const;

export const SECURITY_AUDIT_ENCRYPTED_FIELDS = [
  "actorEmail",
  "ipAddress",
  "userAgent",
] as const;

export const NOTIFICATION_ENCRYPTED_FIELDS = ["title", "body"] as const;

export const ENCRYPTED_FIELDS_BY_MODEL = {
  user: USER_ENCRYPTED_FIELDS,
  facility: FACILITY_ENCRYPTED_FIELDS,
  patient: PATIENT_ENCRYPTED_FIELDS,
  patientMedication: PATIENT_MEDICATION_ENCRYPTED_FIELDS,
  visit: VISIT_ENCRYPTED_FIELDS,
  visitMessage: VISIT_MESSAGE_ENCRYPTED_FIELDS,
  emailOtp: EMAIL_OTP_ENCRYPTED_FIELDS,
  loginActivity: LOGIN_ACTIVITY_ENCRYPTED_FIELDS,
  accountSession: ACCOUNT_SESSION_ENCRYPTED_FIELDS,
  knownLoginDevice: KNOWN_LOGIN_DEVICE_ENCRYPTED_FIELDS,
  securityAuditEvent: SECURITY_AUDIT_ENCRYPTED_FIELDS,
  notification: NOTIFICATION_ENCRYPTED_FIELDS,
} as const;

export type EncryptedPrismaModel = keyof typeof ENCRYPTED_FIELDS_BY_MODEL;

export const RELATION_MODEL_MAP: Record<string, EncryptedPrismaModel> = {
  facility: "facility",
  createdBy: "user",
  provider: "user",
  bookedBy: "user",
  sender: "user",
  patient: "patient",
  medications: "patientMedication",
  messages: "visitMessage",
  user: "user",
  staff: "user",
};

type LookupFieldConfig = {
  sourceField: string;
  hashField: string;
  normalize?: (value: string) => string;
};

export const LOOKUP_HASH_FIELDS_BY_MODEL: Partial<
  Record<EncryptedPrismaModel, LookupFieldConfig[]>
> = {
  user: [
    {
      sourceField: "email",
      hashField: "emailLookupHash",
      normalize: (value) => value.trim().toLowerCase(),
    },
    {
      sourceField: "employeeId",
      hashField: "employeeIdLookupHash",
      normalize: (value) => value.trim(),
    },
  ],
  facility: [
    {
      sourceField: "email",
      hashField: "emailLookupHash",
      normalize: (value) => value.trim().toLowerCase(),
    },
  ],
  patient: [
    {
      sourceField: "email",
      hashField: "emailLookupHash",
      normalize: (value) => value.trim().toLowerCase(),
    },
    {
      sourceField: "memberId",
      hashField: "memberIdLookupHash",
      normalize: (value) => value.trim().toUpperCase(),
    },
  ],
  securityAuditEvent: [
    {
      sourceField: "actorEmail",
      hashField: "actorEmailLookupHash",
      normalize: (value) => value.trim().toLowerCase(),
    },
  ],
};
