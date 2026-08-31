import type { NextFunction, Request, Response } from "express";
import { status as HttpStatus } from "http-status";

import { getAuthUser } from "~/middlewares/auth";
import { HttpError } from "~/middlewares/error-handler";
import { assertPatientAccessForViewer } from "~/services/patient-service";
import { assertVisitAccessForViewer } from "~/services/visit-service";

/** Object-level authorization (§16.2) — 404 when out of scope. */
export function requirePatientParamAccess(paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = getAuthUser(req);
      const rawId = req.params[paramName];
      const patientId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!patientId) {
        throw new HttpError("Patient not found", HttpStatus.NOT_FOUND);
      }
      await assertPatientAccessForViewer(auth, patientId);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireVisitParamAccess(paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = getAuthUser(req);
      const rawId = req.params[paramName];
      const visitId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!visitId) {
        throw new HttpError("Visit not found", HttpStatus.NOT_FOUND);
      }
      await assertVisitAccessForViewer(auth, visitId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
