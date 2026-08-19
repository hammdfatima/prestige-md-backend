import { z } from "zod";

const yesNoSchema = z.enum(["yes", "no"], {
  message: "Select yes or no",
});

const adlLevelSchema = z.enum(["I", "S", "A", "T"], {
  message: "Select an ADL level",
});

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const createPatientSchema = z
  .object({
    name: z.string().min(2, "Resident name is required"),
    dateOfBirth: dateOnlySchema,
    authorizedRepresentative: z.string().optional(),
    phone: z.string().min(10, "Enter a valid phone number"),
    email: z.email("Enter a valid email address").or(z.literal("")),

    nextOfKinName: z.string().min(2, "Next of kin name is required"),
    nextOfKinRelationship: z
      .string()
      .min(1, "Next of kin relationship is required"),
    nextOfKinPhone: z
      .string()
      .min(10, "Enter a valid next of kin phone number"),
    nextOfKinEmail: z.email("Enter a valid next of kin email address"),
    nextOfKinAddress: z.string().min(5, "Next of kin address is required"),

    decisionMaker: z.string().min(2, "Decision maker is required"),

    insuranceProvider: z.string().min(2, "Insurance provider is required"),
    insurancePlanName: z.string().min(1, "Plan name is required"),
    insurancePlanType: z.string().min(1, "Plan type is required"),
    insuranceMemberId: z.string().min(1, "Member / policy ID is required"),
    insuranceGroupNumber: z.string().min(1, "Group number is required"),
    insuranceSubscriberName: z.string().min(2, "Subscriber name is required"),
    insuranceSubscriberRelationship: z
      .string()
      .min(1, "Subscriber relationship is required"),
    insuranceEffectiveDate: dateOnlySchema,
    insurancePhone: z.string().min(10, "Enter a valid insurance phone number"),

    facilityId: z.uuid("Invalid facility id"),

    avatarUrl: z.string().min(1, "Upload a profile photo"),
    avatarPublicId: z.string().optional(),

    knownAllergies: z.string().min(1, "Enter known allergies or None"),
    medicalHistory: z
      .string()
      .min(1, "Medical history and diagnoses are required"),
    height: z.string().min(1, "Height is required"),
    weight: z.string().min(1, "Weight is required"),
    physicalOrSensoryLimitations: z
      .string()
      .min(1, "Physical or sensory limitations are required"),
    cognitiveOrBehavioralStatus: z
      .string()
      .min(1, "Cognitive or behavioral status is required"),
    nursingTreatmentRequirements: z
      .string()
      .min(1, "Nursing/treatment/therapy requirements are required"),
    specialPrecautions: z.string().min(1, "Special precautions are required"),
    elopementRisk: yesNoSchema,

    ambulation: adlLevelSchema,
    bathing: adlLevelSchema,
    dressing: adlLevelSchema,
    eating: adlLevelSchema,
    selfCare: adlLevelSchema,
    toileting: adlLevelSchema,
    transferring: adlLevelSchema,

    specialDiet: z.enum(
      [
        "regular",
        "calorie_controlled",
        "no_added_salt",
        "low_fat_low_cholesterol",
        "other",
      ],
      { message: "Select a special diet" },
    ),
    specialDietOther: z.string().optional(),

    communicableDisease: yesNoSchema,
    bedridden: yesNoSchema,
    pressureSores: yesNoSchema,
    dangerToSelfOrOthers: yesNoSchema,
    require24HourCare: yesNoSchema,
    needsMetInAlf: yesNoSchema,

    currentMedications: z
      .string()
      .min(1, "List currently prescribed medications"),
    needsHelpWithMedications: yesNoSchema,
    medicationAssistance: z
      .enum([
        "self_administer",
        "assistance_with_self_administration",
        "medication_administration",
      ])
      .or(z.literal(""))
      .optional(),
    additionalComments: z.string().optional(),

    examinerName: z.string().min(2, "Examiner name is required"),
    examinerLicenseNumber: z
      .string()
      .min(1, "Medical license number is required"),
    examinerTitle: z.enum(["MD", "DO", "APRN", "PA"], {
      message: "Select examiner title",
    }),
    examinerPhone: z.string().min(10, "Enter a valid examiner phone number"),
    examinerAddress: z.string().min(5, "Examiner address is required"),
    examinationDate: dateOnlySchema,
  })
  .superRefine((values, ctx) => {
    if (values.specialDiet === "other" && !values.specialDietOther?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["specialDietOther"],
        message: "Specify the other diet instructions",
      });
    }

    if (
      values.needsHelpWithMedications === "yes" &&
      !values.medicationAssistance
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["medicationAssistance"],
        message: "Select the level of medication assistance needed",
      });
    }
  });

export const listPatientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  facilityId: z.uuid().optional(),
});

export const patientIdParamsSchema = z.object({
  id: z.uuid("Invalid patient id"),
});

export type CreatePatientBody = z.infer<typeof createPatientSchema>;
export type UpdatePatientBody = CreatePatientBody;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type PatientIdParams = z.infer<typeof patientIdParamsSchema>;
