import { z } from "zod"
import { LOGIN_MFA_CODE_LENGTH } from "~/lib/mfa"
import { newPasswordSchema } from "~/lib/password"

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
})

export const facilityInviteQuerySchema = z.object({
  token: z.string().min(1, "Invite token is required"),
})

export const setFacilityPasswordSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  password: newPasswordSchema,
})

export const updateMeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  avatarUrl: z.string().optional(),
  avatarPublicId: z.string().optional(),
  specialty: z.string().optional(),
  medicalLicense: z.string().optional(),
  education: z.string().optional(),
  yearsExperience: z.string().optional(),
  primaryLanguage: z.string().optional(),
  availability: z.string().optional(),
  location: z.string().optional(),
  facilityName: z.string().optional(),
})

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: newPasswordSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "This reset link is invalid or has expired"),
  password: newPasswordSchema,
})

export const verifyLoginOtpSchema = z.object({
  challengeToken: z.string().min(1, "Login session expired. Please sign in again."),
  code: z
    .string()
    .length(
      LOGIN_MFA_CODE_LENGTH,
      `Enter the ${LOGIN_MFA_CODE_LENGTH}-digit code`,
    )
    .regex(
      new RegExp(`^\\d{${LOGIN_MFA_CODE_LENGTH}}$`),
      `Enter the ${LOGIN_MFA_CODE_LENGTH}-digit code`,
    ),
})

export const resendLoginOtpSchema = z.object({
  challengeToken: z.string().min(1, "Login session expired. Please sign in again."),
})

export const reportLoginSchema = z.object({
  token: z.string().min(1, "This security link is invalid."),
})

export type LoginBody = z.infer<typeof loginSchema>
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>
export type FacilityInviteQuery = z.infer<typeof facilityInviteQuerySchema>
export type SetFacilityPasswordBody = z.infer<typeof setFacilityPasswordSchema>
export type UpdateMeBody = z.infer<typeof updateMeSchema>
export type UpdateAvailabilityBody = z.infer<typeof updateAvailabilitySchema>
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>
export type VerifyLoginOtpBody = z.infer<typeof verifyLoginOtpSchema>
export type ResendLoginOtpBody = z.infer<typeof resendLoginOtpSchema>
export type ReportLoginBody = z.infer<typeof reportLoginSchema>
