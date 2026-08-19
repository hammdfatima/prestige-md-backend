import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
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
  const data = await patientCareService.listMedications(
    getAuthUser(req),
    req.params.id,
  );
  return res.status(HttpStatus.OK).json({
    message: "Medications fetched successfully",
    data,
  });
});

export const createMedicationHandler = asyncHandler<
  PatientMedicationBody,
  PatientIdParams
>(async (req, res) => {
  const data = await patientCareService.createMedication(
    getAuthUser(req),
    req.params.id,
    req.body,
  );
  return res.status(HttpStatus.CREATED).json({
    message: "Medication added successfully",
    data,
  });
});

export const updateMedicationHandler = asyncHandler<
  PatientMedicationBody,
  PatientMedicationIdParams
>(async (req, res) => {
  const data = await patientCareService.updateMedication(
    getAuthUser(req),
    req.params.id,
    req.params.medicationId,
    req.body,
  );
  return res.status(HttpStatus.OK).json({
    message: "Medication updated successfully",
    data,
  });
});

export const deleteMedicationHandler = asyncHandler<
  Record<string, never>,
  PatientMedicationIdParams
>(async (req, res) => {
  const data = await patientCareService.deleteMedication(
    getAuthUser(req),
    req.params.id,
    req.params.medicationId,
  );
  return res.status(HttpStatus.OK).json({
    message: "Medication removed successfully",
    data,
  });
});

export const getNotesHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams
>(async (req, res) => {
  const data = await patientCareService.getNotes(getAuthUser(req), req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Notes fetched successfully",
    data,
  });
});

export const updateNotesHandler = asyncHandler<
  PatientNotesBody,
  PatientIdParams
>(async (req, res) => {
  const data = await patientCareService.updateNotes(
    getAuthUser(req),
    req.params.id,
    req.body,
  );
  return res.status(HttpStatus.OK).json({
    message: "Notes saved successfully",
    data,
  });
});
