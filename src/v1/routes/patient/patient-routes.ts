import { Router } from "express";
import {
  requireAdmin,
  requireNurse,
  requirePatientRead,
  requirePermission,
  requirePermissionForTeamMember,
} from "~/middlewares/auth";
import {
  requirePatientParamAccess,
} from "~/middlewares/resource-access";
import { patientExportLimiter } from "~/middlewares/rate-limiter";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  patientMedicationBodySchema,
  patientMedicationIdParamsSchema,
  patientNotesBodySchema,
} from "~/schemas/patient-care-schemas";
import {
  createPatientSchema,
  exportPatientQuerySchema,
  exportPatientsQuerySchema,
  listPatientsQuerySchema,
  patientDeletionRequestBodySchema,
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
  exportPatientBundleHandler,
  exportPatientsHandler,
  getPatientHandler,
  listPatientsHandler,
  requestPatientDeletionHandler,
  updatePatientHandler,
} from "~/v1/routes/patient/patient-handlers";

const PATIENT_ROUTER = Router();

PATIENT_ROUTER.get(
  "/export",
  requireAdmin,
  requirePermission("manage_patients"),
  patientExportLimiter,
  schemaParseMiddleWare(exportPatientsQuerySchema, "query"),
  exportPatientsHandler,
);

PATIENT_ROUTER.get(
  "/",
  requirePatientRead,
  requirePermissionForTeamMember("manage_patients"),
  schemaParseMiddleWare(listPatientsQuerySchema, "query"),
  listPatientsHandler,
);

PATIENT_ROUTER.get(
  "/:id/medications",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  listMedicationsHandler,
);

PATIENT_ROUTER.post(
  "/:id/medications",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  schemaParseMiddleWare(patientMedicationBodySchema),
  createMedicationHandler,
);

PATIENT_ROUTER.patch(
  "/:id/medications/:medicationId",
  requireNurse,
  schemaParseMiddleWare(patientMedicationIdParamsSchema, "params"),
  requirePatientParamAccess(),
  schemaParseMiddleWare(patientMedicationBodySchema),
  updateMedicationHandler,
);

PATIENT_ROUTER.delete(
  "/:id/medications/:medicationId",
  requireNurse,
  schemaParseMiddleWare(patientMedicationIdParamsSchema, "params"),
  requirePatientParamAccess(),
  deleteMedicationHandler,
);

PATIENT_ROUTER.get(
  "/:id/notes",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  getNotesHandler,
);

PATIENT_ROUTER.patch(
  "/:id/notes",
  requireNurse,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  schemaParseMiddleWare(patientNotesBodySchema),
  updateNotesHandler,
);

PATIENT_ROUTER.get(
  "/:id/export",
  requireAdmin,
  requirePermission("manage_patients"),
  patientExportLimiter,
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  schemaParseMiddleWare(exportPatientQuerySchema, "query"),
  exportPatientBundleHandler,
);

PATIENT_ROUTER.get(
  "/:id",
  requirePatientRead,
  requirePermissionForTeamMember("manage_patients"),
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
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
  requirePatientParamAccess(),
  schemaParseMiddleWare(createPatientSchema),
  updatePatientHandler,
);

PATIENT_ROUTER.post(
  "/:id/deletion-request",
  requireAdmin,
  requirePermission("manage_patients"),
  schemaParseMiddleWare(patientIdParamsSchema, "params"),
  requirePatientParamAccess(),
  schemaParseMiddleWare(patientDeletionRequestBodySchema),
  requestPatientDeletionHandler,
);

export default PATIENT_ROUTER;
