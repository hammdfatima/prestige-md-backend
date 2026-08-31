import type { NextFunction, Request, Response } from "express";
import { UserRole } from "~/generated/prisma/client";
import { verifyToken } from "~/lib/jwt";
import { validateSessionToken } from "~/lib/validate-session-token";
import {
  hasTeamPermission,
  normalizeTeamPermissions,
  type TeamPermissionId,
} from "~/lib/permissions";
import { HttpError } from "~/middlewares/error-handler";
import { status as HttpStatus } from "http-status";
import type { IAuthRequest, TokenPayload } from "~/types";

type AuthMiddlewareOptions = {
  roles?: UserRole[];
  skipIdleCheck?: boolean;
};

async function authenticateRequest(
  req: Request,
  options: AuthMiddlewareOptions,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
  }

  let payload: TokenPayload & { iat?: number };
  try {
    payload = verifyToken(header.slice(7)) as TokenPayload & { iat?: number };
  } catch {
    throw new HttpError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
  }

  const user = await validateSessionToken(payload, {
    skipIdleCheck: options.skipIdleCheck,
    allowedRoles: options.roles,
  });

  (req as IAuthRequest).user = user;
}

function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await authenticateRequest(req, options);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(...roles: UserRole[]) {
  return createAuthMiddleware({ roles });
}

export function requireAuthAllowIdle(...roles: UserRole[]) {
  return createAuthMiddleware({ roles, skipIdleCheck: true });
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

      if (!hasTeamPermission(user, ...anyOf)) {
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

export function requirePermissionForTeamMember(...anyOf: TeamPermissionId[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = getAuthUser(req);

      if (user.role !== UserRole.TEAM_MEMBER) {
        next();
        return;
      }

      if (!hasTeamPermission(user, ...anyOf)) {
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
  UserRole.DOCTOR,
);

export { normalizeTeamPermissions };
