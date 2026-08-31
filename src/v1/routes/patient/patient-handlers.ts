import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { auditContextFromRequest } from "~/lib/audit-request-context";
import {
  recordPatientDeletionRequested,
  recordPatientRecordCreated,
  recordPatientRecordExported,
  recordPatientRecordUpdated,
  recordPatientRecordViewed,
} from "~/lib/phi-access-audit";
import { getAuthUser } from "~/middlewares/auth";
import type {
  CreatePatientBody,
  ExportPatientQuery,
  ExportPatientsQuery,
  ListPatientsQuery,
  PatientDeletionRequestBody,
  PatientIdParams,
} from "~/schemas/patient-schemas";
import { exportPatientBundle } from "~/services/patient-export-service";
import * as patientService from "~/services/patient-service";

export const createPatientHandler = asyncHandler<CreatePatientBody>(
  async (req, res) => {
    const user = getAuthUser(req);
    const auditContext = auditContextFromRequest(req);
    const data = await patientService.createPatient(req.body, user);
    recordPatientRecordCreated(user, data.id, auditContext);
    return res.status(HttpStatus.CREATED).json({
      message: "Patient added successfully",
      data,
    });
  },
);

export const listPatientsHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListPatientsQuery
>(async (req, res) => {
  const data = await patientService.listPatientsForViewer(
    getAuthUser(req),
    req.query,
  );
  return res.status(HttpStatus.OK).json({
    message: "Patients fetched successfully",
    data,
  });
});

export const getPatientHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientService.getPatientForViewer(user, req.params.id);
  recordPatientRecordViewed(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Patient fetched successfully",
    data,
  });
});

export const updatePatientHandler = asyncHandler<
  CreatePatientBody,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientService.updatePatient(req.params.id, req.body, user);
  recordPatientRecordUpdated(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Patient updated successfully",
    data,
  });
});

export const exportPatientsHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ExportPatientsQuery
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientService.exportPatientsForViewer(
    user,
    String(req.query.stepUpToken ?? ""),
  );
  recordPatientRecordExported(user, "patient_export_list", auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Patient export ready",
    data,
  });
});

export const exportPatientBundleHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams,
  ExportPatientQuery
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await exportPatientBundle(
    user,
    req.params.id,
    String(req.query.stepUpToken ?? ""),
  );
  recordPatientRecordExported(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Patient chart export ready",
    data,
  });
});

export const requestPatientDeletionHandler = asyncHandler<
  PatientDeletionRequestBody,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientService.requestPatientDeletion(
    user,
    req.params.id,
    req.body.stepUpToken,
  );
  recordPatientDeletionRequested(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Patient deletion request recorded",
    data,
  });
});
