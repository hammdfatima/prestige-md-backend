import type { RequestHandler, NextFunction, Response } from "express";
import type { IAuthRequest } from "~/types";

type Empty = Record<string, never>;

type AsyncHandler<Body = Empty, Params = Empty, Query = Empty> = (
  req: IAuthRequest<Body, Params, Query>,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler = <
  Body = Empty,
  Params = Empty,
  Query = Empty,
>(
  requestHandler: AsyncHandler<Body, Params, Query>,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(
      requestHandler(req as IAuthRequest<Body, Params, Query>, res, next),
    ).catch(next);
  };
};
