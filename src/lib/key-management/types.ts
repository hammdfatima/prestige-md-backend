export type KeyManagementProviderName = "env" | "aws-kms";

export type KeyUsageOperation =
  | "ENV_KEY_LOAD"
  | "KMS_DECRYPT"
  | "KMS_GENERATE_DATA_KEY"
  | "FIELD_ENCRYPT"
  | "FIELD_DECRYPT"
  | "LOOKUP_HASH";

export type KeyUsageLogEntry = {
  operation: KeyUsageOperation;
  provider: KeyManagementProviderName;
  keyVersion: string;
  keyId?: string;
  service: string;
  success: boolean;
  errorMessage?: string;
};
