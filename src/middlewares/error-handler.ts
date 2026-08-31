import logger from "~/lib/logger";
import { sanitizeLogMessage } from "~/lib/sanitize-for-log";
import {
  httpStatusToErrorCode,
  type ApiErrorDetail,
} from "~/lib/api-response";
import type { Request, Response, NextFunction } from "express";

const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logger.error(sanitizeLogMessage(err.stack ?? err.message));
  const statusCode = err instanceof HttpError ? err.statusCode : 500;

  return res.status(statusCode).json({
    success: false,
    error: {
      code:
        err instanceof HttpError
          ? err.code
          : httpStatusToErrorCode(statusCode),
      message: err.message || "Internal Server Error",
      ...(err instanceof HttpError && err.details?.length
        ? { details: err.details }
        : {}),
    },
  });
};

export default errorHandler;

export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? httpStatusToErrorCode(statusCode);
    this.details = details;
  }
}
