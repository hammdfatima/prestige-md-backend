import { status as HttpStatus } from "http-status";
import prisma from "~/lib/db";
import { patientInclude } from "~/lib/patient-include";
import { HttpError } from "~/middlewares/error-handler";

/** A provider has a care relationship with a patient when they share at least one visit. */
export async function providerHasPatientCareRelationship(
  providerId: string,
  patientId: string,
): Promise<boolean> {
  const visit = await prisma.visit.findFirst({
    where: { providerId, patientId },
    select: { id: true },
  });
  return Boolean(visit);
}

/** Distinct patient IDs linked to a provider through visits. */
export async function listPatientIdsForProvider(providerId: string) {
  const visits = await prisma.visit.findMany({
    where: { providerId },
    select: { patientId: true },
    distinct: ["patientId"],
  });
  return visits.map((visit) => visit.patientId);
}

/**
 * Provider-scoped patient lookup. Returns 404 when no care relationship exists,
 * so callers cannot infer whether a patient ID is valid.
 */
export async function getPatientRecordForProvider(
  providerId: string,
  patientId: string,
) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      visits: { some: { providerId } },
    },
    include: patientInclude,
  });

  if (!patient) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  return patient;
}

/**
 * Facility-scoped patient lookup for nurses and facility managers.
 * Returns 404 when the patient is outside the staff member's facility.
 */
export async function getPatientRecordForFacilityStaff(
  facilityId: string,
  patientId: string,
) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      facilityId,
    },
    include: patientInclude,
  });

  if (!patient) {
    throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
  }

  return patient;
}

/** Visit must belong to the provider (care-team assignment). */
export async function getVisitRecordForProvider(
  providerId: string,
  visitId: string,
) {
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, providerId },
    select: { id: true },
  });

  if (!visit) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  return visit;
}

/** Visit patient must belong to the nurse/facility manager's facility. */
export async function getVisitRecordForFacilityStaff(
  facilityId: string,
  visitId: string,
) {
  const visit = await prisma.visit.findFirst({
    where: {
      id: visitId,
      patient: { facilityId },
    },
    select: { id: true },
  });

  if (!visit) {
    throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
  }

  return visit;
}
