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

const EnvSchema = z.object({
  PORT_NO: z.coerce.number().min(1).max(65535),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  REDIS_URL: z.url().optional(),
  APP_URL: z.url().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Optional public HTTPS logo URL. When unset, emails embed the logo inline. */
  EMAIL_LOGO_URL: z.url().optional(),
  /** Public API base URL used by the keep-alive pinger (e.g. https://api.onrender.com). */
  KEEP_ALIVE_URL: z.url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),
  /** Legacy alias for AGORA_APP_CERTIFICATE */
  AGORA_APP_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default parsed.data;
