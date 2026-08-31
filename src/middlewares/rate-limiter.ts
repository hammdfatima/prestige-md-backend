/** HIPAA §7.3 API rate limiting — global, login, and export throttles. */
import rateLimit, { type Options } from "express-rate-limit";
import { status as HttpStatus } from "http-status";
import env from "~/env";
import logger from "~/lib/logger";

function rateLimitHandler(message: string) {
  return (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message,
      },
    });
  };
}

const limiterOptions: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "Too many requests from this IP, please try again later.",
  ),
};

if (env.REDIS_URL) {
  logger.warn(
    "REDIS_URL is set, but Redis is unreachable from this environment. Rate limiting will use the in-memory store.",
  );
} else {
  logger.warn("REDIS_URL is not set; rate limiting will use in-memory store.");
}

export const limiter = rateLimit(limiterOptions);

export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "Too many login attempts from this IP, please try again later.",
  ),
});

export const patientExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "Too many patient export requests. Try again later.",
  ),
});
