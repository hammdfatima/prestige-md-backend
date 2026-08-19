import { Router } from "express";
import {
  requireAdmin,
  requireNurse,
  requirePatientRead,
  requirePermission,
} from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  patientMedicationBodySchema,
  patientMedicationIdParamsSchema,
  patientNotesBodySchema,
} from "~/schemas/patient-care-schemas";
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdParamsSchema,
} from "~/schemas/patient-schemas";
import {
  createMedicationHandler,
  deleteMedicationHandler,
  getNotesHandler,
  listMedicationsHandler,
  updateMedicationHandler,
  updateNotesHandler,
} from "~/v1/routes/patient/patient-care-handlers";
import {
  createPatientHandler,
  deletePatientHandler,
  getPatientHandler,
  listPatientsHandler,
  updatePatientHandler,
} from "~/v1/routes/patient/patient-handlers";

const PATIENT_ROUTER = Router();

PATIENT_ROUTER.get(
  "/",
  requirePatientRead,
  schemaParseMiddleWare(listPatientsQuerySchema, "query"),
  listPatientsHandler,
);

PATIENT_ROUTER.get(
  "/:id/medications",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  listMedicationsHandler,
);

PATIENT_ROUTER.post(
  "/:id/medications",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  schemaParseMiddleWare(patientMedicationBodySchema),
  createMedicationHandler,
);

PATIENT_ROUTER.patch(
  "/:id/medications/:medicationId",
  requireNurse,
  schemaParseMiddleWare(patientMedicationIdParamsSchema, "params"),
  schemaParseMiddleWare(patientMedicationBodySchema),
  updateMedicationHandler,
);

PATIENT_ROUTER.delete(
  "/:id/medications/:medicationId",
  requireNurse,
  schemaParseMiddleWare(patientMedicationIdParamsSchema, "params"),
  deleteMedicationHandler,
);

PATIENT_ROUTER.get(
  "/:id/notes",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  getNotesHandler,
);

PATIENT_ROUTER.patch(
  "/:id/notes",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  schemaParseMiddleWare(patientNotesBodySchema),
  updateNotesHandler,
);

PATIENT_ROUTER.get(
  "/:id",
  requirePatientRead,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  getPatientHandler,
);

PATIENT_ROUTER.post(
  "/",
  requireAdmin,
  requirePermission("manage_patients"),
  schemaParseMiddleWare(createPatientSchema),
  createPatientHandler,
);

PATIENT_ROUTER.patch(
  "/:id",
  requireAdmin,
  requirePermission("manage_patients"),
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  schemaParseMiddleWare(createPatientSchema),
  updatePatientHandler,
);

PATIENT_ROUTER.delete(
  "/:id",
  requireAdmin,
  requirePermission("manage_patients"),
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  deletePatientHandler,
);

export default PATIENT_ROUTER;
