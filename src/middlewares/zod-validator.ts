import type { NextFunction, Request, Response } from "express";
import { type ZodType, ZodError } from "zod";
import logger from "~/lib/logger";

type RequestSource = "body" | "query" | "params";

export const schemaParseMiddleWare =
  (schema: ZodType, source: RequestSource = "body") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      // Express 5 makes req.query (and sometimes req.params) read-only getters.
      if (source === "body") {
        req.body = parsed;
      }
      next();
    } catch (error) {
      logger.error(error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.issues.map((err) => err.message),
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  };
