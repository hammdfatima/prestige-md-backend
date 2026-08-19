import { z } from "zod";

export const createFacilitySchema = z.object({
  name: z.string().min(2, "Facility name is required"),
  managerName: z.string().min(2, "Manager name is required"),
  email: z.email("Enter a valid email address"),
  location: z.string().min(5, "Location is required"),
  phone: z.string().min(10, "Enter a valid phone number"),
});

export const listFacilitiesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const facilityIdParamsSchema = z.object({
  id: z.uuid("Invalid facility id"),
});

export type CreateFacilityBody = z.infer<typeof createFacilitySchema>;
export type ListFacilitiesQuery = z.infer<typeof listFacilitiesQuerySchema>;
export type FacilityIdParams = z.infer<typeof facilityIdParamsSchema>;
