/** HIPAA §1.1 password policy — complexity and common-password blocklist. */
import { status as HttpStatus } from "http-status";
import { z } from "zod";

import { COMMON_PASSWORDS } from "./common-passwords-data";
import { HttpError } from "~/middlewares/error-handler";

const COMMON_PASSWORD_MESSAGE =
  "This password is too common and has appeared in data breaches. Please choose a different one.";

/** Returns true when the password appears in the top-10k common/breached list. */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

const passwordComplexitySchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

/**
 * Canonical password policy for every set / reset / change flow.
 * Import this in Zod schemas — do not duplicate min/regex checks elsewhere.
 */
export const strongPasswordSchema = passwordComplexitySchema.superRefine(
  (password, ctx) => {
    if (isCommonPassword(password)) {
      ctx.addIssue({
        code: "custom",
        message: COMMON_PASSWORD_MESSAGE,
      });
    }
  },
);

/** Alias used by auth schemas for any newly chosen password field. */
export const newPasswordSchema = strongPasswordSchema;

export const STRONG_PASSWORD_HINT =
  "Use at least 8 characters with uppercase, lowercase, and a number. Avoid common or breached passwords.";

/** Authoritative server-side enforcement — call before persisting any new password. */
export function assertStrongPassword(password: string): void {
  const result = strongPasswordSchema.safeParse(password);

  if (!result.success) {
    throw new HttpError(
      result.error.issues[0]?.message ??
        "Password does not meet policy requirements",
      HttpStatus.BAD_REQUEST,
    );
  }
}
