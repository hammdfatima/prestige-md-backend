/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    ),
  }),
);

const httpsUrlInProduction = z
  .url()
  .superRefine((url, ctx) => {
    if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        message: "URL must use HTTPS in production",
      });
    }
  });

const EnvSchema = z
  .object({
    PORT_NO: z.coerce.number().min(1).max(65535),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string(),
    /** 32-byte AES-256 key (base64). Dev only — production uses AWS KMS wrapped DEK. */
    DATA_ENCRYPTION_KEY: z.string().optional(),
    /** Active data-encryption key version label (used in enc:v2 ciphertext). */
    DATA_ENCRYPTION_KEY_VERSION: z.string().default("primary"),
    /** Prior key version label when rotating (paired with AWS_KMS_LEGACY_WRAPPED_DEK). */
    DATA_ENCRYPTION_LEGACY_KEY_VERSION: z.string().optional(),
    /** env = local/dev key file; aws-kms = customer-managed KMS key (required in production). */
    KEY_MANAGEMENT_PROVIDER: z.enum(["env", "aws-kms"]).default("env"),
    AWS_KMS_KEY_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    /** Base64 KMS-wrapped 32-byte data encryption key for the active key version. */
    AWS_KMS_WRAPPED_DEK: z.string().optional(),
    /** Base64 KMS-wrapped prior DEK — register for decrypting data encrypted before rotation. */
    AWS_KMS_LEGACY_WRAPPED_DEK: z.string().optional(),
    /** Service identity included in key-usage audit logs. */
    SERVICE_NAME: z.string().default("prestige-md-backend"),
    /** Run the daily retention/destruction job. */
    RETENTION_JOB_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((value) => value === "true"),
    /** When false (default), retention job logs candidates only — no deletes. */
    RETENTION_JOB_LIVE: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform((value) => value === "true"),
    REDIS_URL: z.url().optional(),
    APP_URL: httpsUrlInProduction.optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    /** Optional public HTTPS logo URL. When unset, emails embed the logo inline. */
    EMAIL_LOGO_URL: z.url().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    /** Optional signed upload preset enforced on startup (defaults to prestige-md-signed). */
    CLOUDINARY_SIGNED_UPLOAD_PRESET: z.string().optional(),
    /** When true, POST PDFs/docs to MALWARE_SCAN_WEBHOOK_URL after upload. */
    MALWARE_SCAN_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform((value) => value === "true"),
    /** Webhook that accepts scan payloads and returns `{ "clean": true }`. */
    MALWARE_SCAN_WEBHOOK_URL: z.url().optional(),
    AGORA_APP_ID: z.string().optional(),
    AGORA_APP_CERTIFICATE: z.string().optional(),
    /** Legacy alias for AGORA_APP_CERTIFICATE */
    AGORA_APP_TOKEN: z.string().optional(),
    /** When true, login requires email OTP after password. Defaults to false for local dev. */
    MFA_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((data, ctx) => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (data.KEY_MANAGEMENT_PROVIDER !== "aws-kms") {
      ctx.addIssue({
        code: "custom",
        path: ["KEY_MANAGEMENT_PROVIDER"],
        message:
          "Production must use KEY_MANAGEMENT_PROVIDER=aws-kms (customer-managed keys)",
      });
    }

    if (!data.AWS_KMS_KEY_ID?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["AWS_KMS_KEY_ID"],
        message: "AWS_KMS_KEY_ID is required in production",
      });
    }

    if (!data.AWS_REGION?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["AWS_REGION"],
        message: "AWS_REGION is required in production",
      });
    }

    if (!data.AWS_KMS_WRAPPED_DEK?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["AWS_KMS_WRAPPED_DEK"],
        message: "AWS_KMS_WRAPPED_DEK is required in production",
      });
    }

    if (data.DATA_ENCRYPTION_KEY?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["DATA_ENCRYPTION_KEY"],
        message:
          "Do not store plaintext DATA_ENCRYPTION_KEY in production — use AWS_KMS_WRAPPED_DEK",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default parsed.data;
