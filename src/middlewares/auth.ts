import type { NextFunction, Request, Response } from "express";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { verifyToken } from "~/lib/jwt";
import { normalizeTeamPermissions, type TeamPermissionId } from "~/lib/permissions";
import { HttpError } from "~/middlewares/error-handler";
import type { IAuthRequest } from "~/types";

export function requireAuth(...roles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
      }

      let payload;
      try {
        payload = verifyToken(header.slice(7));
      } catch {
        throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          role: true,
          status: true,
          permissions: true,
          facilityId: true,
          facilityLinks: { select: { facilityId: true }, take: 1 },
        },
      });

      if (user) {
        if (user.status !== UserStatus.ACTIVE) {
          throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
        }

        if (roles.length > 0 && !roles.includes(user.role)) {
          throw new HttpError(
            "You do not have access to this resource",
            HttpStatus.FORBIDDEN,
          );
        }

        (req as IAuthRequest).user = {
          id: user.id,
          role: user.role,
          permissions: normalizeTeamPermissions(user.permissions),
          facilityId: user.facilityId ?? user.facilityLinks[0]?.facilityId ?? null,
        };
        next();
        return;
      }

      const facility = await prisma.facility.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true },
      });

      if (!facility || facility.status !== UserStatus.ACTIVE) {
        throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
      }

      if (roles.length > 0 && !roles.includes(UserRole.FACILITY_MANAGER)) {
        throw new HttpError(
          "You do not have access to this resource",
          HttpStatus.FORBIDDEN,
        );
      }

      (req as IAuthRequest).user = {
        id: facility.id,
        role: UserRole.FACILITY_MANAGER,
        facilityId: facility.id,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getAuthUser(req: Request) {
  const user = (req as IAuthRequest).user;
  if (!user) {
    throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
  }
  return user;
}

export function requirePermission(...anyOf: TeamPermissionId[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = getAuthUser(req);

      if (user.role === UserRole.ADMIN) {
        next();
        return;
      }

      if (user.role !== UserRole.TEAM_MEMBER) {
        throw new HttpError(
          "You do not have access to this resource",
          HttpStatus.FORBIDDEN,
        );
      }

      const granted = new Set(user.permissions ?? []);
      const allowed = anyOf.some((permission) => granted.has(permission));

      if (!allowed) {
        throw new HttpError(
          "You do not have access to this resource",
          HttpStatus.FORBIDDEN,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAdmin = requireAuth(
  UserRole.ADMIN,
  UserRole.TEAM_MEMBER,
);

export const requireNurse = requireAuth(UserRole.NURSE);

export const requireDoctor = requireAuth(UserRole.DOCTOR);

export const requireFacilityManager = requireAuth(UserRole.FACILITY_MANAGER);

export const requirePatientRead = requireAuth(
  UserRole.ADMIN,
  UserRole.TEAM_MEMBER,
  UserRole.NURSE,
  UserRole.FACILITY_MANAGER,
);
