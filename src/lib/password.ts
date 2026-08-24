import { z } from "zod"

/** Shared strong-password rules for set / reset / change password flows. */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Include at least one special character (e.g. !@#$%)",
  )

export const STRONG_PASSWORD_HINT =
  "Use at least 8 characters with uppercase, lowercase, a number, and a special character."
