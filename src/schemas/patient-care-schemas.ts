import { z } from "zod";

export const patientMedicationBodySchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  instructions: z.string().min(1, "Instructions are required"),
});

export const patientNotesBodySchema = z.object({
  notes: z.string(),
});

export const patientMedicationIdParamsSchema = z.object({
  id: z.uuid("Invalid patient id"),
  medicationId: z.uuid("Invalid medication id"),
});

export type PatientMedicationBody = z.infer<typeof patientMedicationBodySchema>;
export type PatientNotesBody = z.infer<typeof patientNotesBodySchema>;
export type PatientMedicationIdParams = z.infer<
  typeof patientMedicationIdParamsSchema
>;
