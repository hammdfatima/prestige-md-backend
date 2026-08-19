import { z } from "zod";

export const createNurseSchema = z.object({
  name: z.string().min(2, "Name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  facilityId: z.uuid("Invalid facility id"),
  avatarUrl: z.string().optional(),
  avatarPublicId: z.string().optional(),
});

export const listNursesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  facilityId: z.uuid().optional(),
});

export const nurseIdParamsSchema = z.object({
  id: z.uuid("Invalid nurse id"),
});

export type CreateNurseBody = z.infer<typeof createNurseSchema>;
export type ListNursesQuery = z.infer<typeof listNursesQuerySchema>;
export type NurseIdParams = z.infer<typeof nurseIdParamsSchema>;
