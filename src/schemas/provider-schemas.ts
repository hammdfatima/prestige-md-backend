import { z } from "zod";

export const createProviderSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  specialty: z.string().min(1, "Select a specialty"),
  medicalLicense: z.string().min(1, "Medical license number is required"),
  education: z.string().min(1, "Education is required"),
  yearsExperience: z.string().min(1, "Years of experience is required"),
  facilityIds: z
    .array(z.uuid("Invalid facility id"))
    .min(1, "Assign the provider to at least one facility"),
  primaryLanguage: z.string().min(1, "Select a primary language"),
  availability: z.string().min(1, "Availability is required"),
  avatarUrl: z.string().optional(),
  avatarPublicId: z.string().optional(),
});

export const listProvidersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  facilityId: z.uuid().optional(),
});

export const providerIdParamsSchema = z.object({
  id: z.uuid("Invalid provider id"),
});

export type CreateProviderBody = z.infer<typeof createProviderSchema>;
export type ListProvidersQuery = z.infer<typeof listProvidersQuerySchema>;
export type ProviderIdParams = z.infer<typeof providerIdParamsSchema>;
