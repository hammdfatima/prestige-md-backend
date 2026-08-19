import type { Request } from "express";
import type { UserRole } from "~/generated/prisma/client";

type Empty = Record<string, never>;

export type TRequest<T, P = Empty, Q = Empty> = Request<P, Empty, T, Q>;

export interface IAuthRequest<T = Empty, P = Empty, Q = Empty>
  extends Request<P, Empty, T, Q> {
  user?: TokenPayload;
}

export type TokenPayload = {
  id: string;
  role: UserRole;
  permissions?: string[];
  facilityId?: string | null;
};
