import { z } from "zod";

export const createVisitSchema = z.object({
  patientId: z.uuid("Invalid patient id"),
  providerId: z.uuid("Invalid provider id"),
  reason: z.string().min(1, "Visit reason is required"),
});

export const listVisitsQuerySchema = z.object({
  patientId: z.uuid("Invalid patient id").optional(),
});

export const visitIdParamsSchema = z.object({
  id: z.uuid("Invalid visit id"),
});

export type CreateVisitBody = z.infer<typeof createVisitSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
export type VisitIdParams = z.infer<typeof visitIdParamsSchema>;
