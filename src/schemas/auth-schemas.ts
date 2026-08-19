import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const createAdminSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

export const facilityInviteQuerySchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export const setFacilityPasswordSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

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
});

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type CreateAdminBody = z.infer<typeof createAdminSchema>;
export type FacilityInviteQuery = z.infer<typeof facilityInviteQuerySchema>;
export type SetFacilityPasswordBody = z.infer<typeof setFacilityPasswordSchema>;
export type UpdateMeBody = z.infer<typeof updateMeSchema>;
export type UpdateAvailabilityBody = z.infer<typeof updateAvailabilitySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
