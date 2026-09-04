import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { auditContextFromRequest } from "~/lib/audit-request-context";
import {
  recordClinicalNotesUpdated,
  recordClinicalNotesViewed,
  recordPrescriptionCreated,
  recordPrescriptionDeleted,
  recordPrescriptionUpdated,
  recordPrescriptionViewed,
} from "~/lib/phi-access-audit";
import { getAuthUser } from "~/middlewares/auth";
import type {
  PatientMedicationBody,
  PatientMedicationIdParams,
  PatientNotesBody,
} from "~/schemas/patient-care-schemas";
import type { PatientIdParams } from "~/schemas/patient-schemas";
import * as patientCareService from "~/services/patient-care-service";

export const listMedicationsHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.listMedications(user, req.params.id);
  await recordPrescriptionViewed(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Medications fetched successfully",
    data,
  });
});

export const createMedicationHandler = asyncHandler<
  PatientMedicationBody,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.createMedication(
    user,
    req.params.id,
    req.body,
  );
  await recordPrescriptionCreated(user, data.id, auditContext);
  return res.status(HttpStatus.CREATED).json({
    message: "Medication added successfully",
    data,
  });
});

export const updateMedicationHandler = asyncHandler<
  PatientMedicationBody,
  PatientMedicationIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.updateMedication(
    user,
    req.params.id,
    req.params.medicationId,
    req.body,
  );
  await recordPrescriptionUpdated(user, data.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Medication updated successfully",
    data,
  });
});

export const deleteMedicationHandler = asyncHandler<
  Record<string, never>,
  PatientMedicationIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.deleteMedication(
    user,
    req.params.id,
    req.params.medicationId,
  );
  await recordPrescriptionDeleted(user, data.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Medication removed successfully",
    data,
  });
});

export const getNotesHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.getNotes(user, req.params.id);
  await recordClinicalNotesViewed(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Notes fetched successfully",
    data,
  });
});

export const updateNotesHandler = asyncHandler<
  PatientNotesBody,
  PatientIdParams
>(async (req, res) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await patientCareService.updateNotes(
    user,
    req.params.id,
    req.body,
  );
  await recordClinicalNotesUpdated(user, req.params.id, auditContext);
  return res.status(HttpStatus.OK).json({
    message: "Notes saved successfully",
    data,
  });
});
