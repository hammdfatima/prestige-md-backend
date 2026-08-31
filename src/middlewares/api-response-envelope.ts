import type { NextFunction, Request, Response } from "express";

import {
  normalizeErrorBody,
  normalizeSuccessBody,
} from "~/lib/api-response";

/**
 * Wraps `res.json` so every API response uses the standard envelope:
 * - success: `{ success: true, message, data }`
 * - failure: `{ success: false, error: { code, message, details? } }`
 *
 * Handlers may still return legacy `{ message, data }` shapes; this middleware
 * normalizes them based on the HTTP status code (never 200 + error payload).
 */
export function apiResponseEnvelopeMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const originalJson = res.json.bind(res);

  res.json = function jsonWithEnvelope(body?: unknown) {
    const statusCode = res.statusCode || 200;

    if (body && typeof body === "object" && body !== null && "success" in body) {
      return originalJson(body);
    }

    if (statusCode >= 400) {
      return originalJson(normalizeErrorBody(statusCode, body));
    }

    return originalJson(normalizeSuccessBody(body));
  };

  next();
}
