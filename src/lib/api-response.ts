import type { Response } from "express";
import { status as HttpStatus } from "http-status";
import type { ZodIssue } from "zod";

export type ApiErrorDetail = {
  field?: string;
  message: string;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
};

export type ApiSuccessBody<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailureBody = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponseBody<T> = ApiSuccessBody<T> | ApiFailureBody;

export function httpStatusToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.METHOD_NOT_ALLOWED:
      return "METHOD_NOT_ALLOWED";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.PRECONDITION_REQUIRED:
      return "PRECONDITION_REQUIRED";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    case HttpStatus.SERVICE_UNAVAILABLE:
      return "SERVICE_UNAVAILABLE";
    case HttpStatus.BAD_GATEWAY:
      return "BAD_GATEWAY";
    default:
      return statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}

export function zodIssuesToDetails(issues: ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : undefined,
    message: issue.message,
  }));
}

export function normalizeSuccessBody(body: unknown): ApiSuccessBody<unknown> {
  if (body && typeof body === "object" && body !== null && "message" in body) {
    const legacy = body as { message?: string; data?: unknown; success?: boolean };
    if (legacy.success === true && "data" in legacy) {
      return {
        success: true,
        message: typeof legacy.message === "string" ? legacy.message : "OK",
        data: legacy.data ?? null,
      };
    }

    return {
      success: true,
      message: typeof legacy.message === "string" ? legacy.message : "OK",
      data: "data" in legacy ? (legacy.data ?? null) : null,
    };
  }

  return {
    success: true,
    message: "OK",
    data: body ?? null,
  };
}

export function normalizeErrorBody(
  statusCode: number,
  body: unknown,
): ApiFailureBody {
  if (body && typeof body === "object" && body !== null) {
    const legacy = body as {
      message?: string;
      errors?: string[];
      error?: ApiErrorBody;
      code?: string;
      details?: ApiErrorDetail[];
    };

    if (legacy.error && typeof legacy.error === "object") {
      return {
        success: false,
        error: {
          code: legacy.error.code ?? httpStatusToErrorCode(statusCode),
          message: legacy.error.message,
          ...(legacy.error.details?.length
            ? { details: legacy.error.details }
            : {}),
        },
      };
    }

    const detailsFromStrings = legacy.errors?.map((message) => ({ message }));
    const details = legacy.details?.length
      ? legacy.details
      : detailsFromStrings;

    return {
      success: false,
      error: {
        code: legacy.code ?? httpStatusToErrorCode(statusCode),
        message: legacy.message ?? "Request failed",
        ...(details?.length ? { details } : {}),
      },
    };
  }

  return {
    success: false,
    error: {
      code: httpStatusToErrorCode(statusCode),
      message: typeof body === "string" ? body : "Request failed",
    },
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode: number = HttpStatus.OK,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } satisfies ApiSuccessBody<T>);
}

export function sendCreated<T>(res: Response, data: T, message = "Created") {
  return sendSuccess(res, data, message, HttpStatus.CREATED);
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code?: string,
  details?: ApiErrorDetail[],
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: code ?? httpStatusToErrorCode(statusCode),
      message,
      ...(details?.length ? { details } : {}),
    },
  } satisfies ApiFailureBody);
}

export function sendValidationError(
  res: Response,
  message: string,
  details: ApiErrorDetail[],
) {
  return sendError(
    res,
    HttpStatus.BAD_REQUEST,
    message,
    "VALIDATION_ERROR",
    details,
  );
}
