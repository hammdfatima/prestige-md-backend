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

export const updateVisitNotesSchema = z
  .object({
    progressNotes: z.string().optional(),
    soapNotes: z
      .object({
        subjective: z.string(),
        objective: z.string(),
        assessment: z.string(),
        plan: z.string(),
      })
      .optional(),
  })
  .refine(
    (value) => value.progressNotes !== undefined || value.soapNotes !== undefined,
    { message: "Provide progress notes or SOAP notes to update" },
  );

export const visitMessageAttachmentSchema = z.object({
  url: z.string().url("Invalid attachment url"),
  publicId: z.string().min(1, "Attachment public id is required"),
  mimeType: z.string().min(1, "Attachment mime type is required"),
  filename: z.string().min(1, "Attachment filename is required"),
  bytes: z.number().int().nonnegative().nullable().optional(),
});

export const sendVisitMessageSchema = z
  .object({
    body: z.string().optional(),
    attachment: visitMessageAttachmentSchema.optional(),
  })
  .refine(
    (value) =>
      Boolean(value.body?.trim()) || Boolean(value.attachment),
    { message: "Message text or attachment is required" },
  );

export type CreateVisitBody = z.infer<typeof createVisitSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
export type VisitIdParams = z.infer<typeof visitIdParamsSchema>;
export type UpdateVisitNotesBody = z.infer<typeof updateVisitNotesSchema>;
export type SendVisitMessageBody = z.infer<typeof sendVisitMessageSchema>;
