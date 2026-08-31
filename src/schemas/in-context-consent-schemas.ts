import { z } from "zod";

export const acceptInContextConsentSchema = z.object({
  consentType: z.enum(["TELEHEALTH_SESSION", "CLINICAL_NOTES"]),
});

export type AcceptInContextConsentBody = z.infer<
  typeof acceptInContextConsentSchema
>;
