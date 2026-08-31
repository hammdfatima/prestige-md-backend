import type { NextFunction, Request, Response } from "express";
import { type ZodType, ZodError } from "zod";
import { sendValidationError, zodIssuesToDetails } from "~/lib/api-response";
import logger from "~/lib/logger";
import { sanitizeForLog } from "~/lib/sanitize-for-log";

type RequestSource = "body" | "query" | "params";

function assignParsedRequestValue(
  req: Request,
  source: RequestSource,
  parsed: unknown,
) {
  if (source === "body") {
    req.body = parsed;
    return;
  }

  Object.defineProperty(req, source, {
    value: parsed,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export const schemaParseMiddleWare =
  (schema: ZodType, source: RequestSource = "body") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      assignParsedRequestValue(req, source, parsed);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error(
          `Validation error on ${source}: ${JSON.stringify(
            sanitizeForLog(req[source] as Record<string, unknown>),
          )} — ${error.issues.map((issue) => issue.message).join("; ")}`,
        );
        return sendValidationError(
          res,
          "Validation error",
          zodIssuesToDetails(error.issues),
        );
      }

      logger.error(
        `Unexpected validation error on ${source}: ${JSON.stringify(
          sanitizeForLog(req[source] as Record<string, unknown>),
        )}`,
      );

      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      });
    }
  };
