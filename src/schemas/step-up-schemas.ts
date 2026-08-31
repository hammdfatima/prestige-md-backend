import { z } from "zod";

export const stepUpSchema = z.object({
  password: z.string().min(1, "Password is required"),
  action: z.string().trim().min(1).optional(),
});

export const stepUpTokenField = z
  .string()
  .min(1, "Step-up authentication is required");

export type StepUpBody = z.infer<typeof stepUpSchema>;
