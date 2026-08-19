import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import type {
  CreatePatientBody,
  ListPatientsQuery,
  PatientIdParams,
} from "~/schemas/patient-schemas";
import * as patientService from "~/services/patient-service";

export const createPatientHandler = asyncHandler<CreatePatientBody>(
  async (req, res) => {
    const user = getAuthUser(req);
    const data = await patientService.createPatient(req.body, user.id);
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
  const data = await patientService.getPatientForViewer(
    getAuthUser(req),
    req.params.id,
  );
  return res.status(HttpStatus.OK).json({
    message: "Patient fetched successfully",
    data,
  });
});

export const updatePatientHandler = asyncHandler<
  CreatePatientBody,
  PatientIdParams
>(async (req, res) => {
  const data = await patientService.updatePatient(req.params.id, req.body);
  return res.status(HttpStatus.OK).json({
    message: "Patient updated successfully",
    data,
  });
});

export const deletePatientHandler = asyncHandler<
  Record<string, never>,
  PatientIdParams
>(async (req, res) => {
  const data = await patientService.deletePatient(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Patient removed successfully",
    data,
  });
});
