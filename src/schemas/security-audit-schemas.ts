import { z } from "zod";

export const listSecurityAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  eventType: z.string().trim().optional(),
  actorEmail: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  targetResource: z.string().trim().optional(),
  dateFrom: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom must be YYYY-MM-DD")
    .optional(),
  dateTo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo must be YYYY-MM-DD")
    .optional(),
});

export type ListSecurityAuditQuery = z.infer<
  typeof listSecurityAuditQuerySchema
>;
