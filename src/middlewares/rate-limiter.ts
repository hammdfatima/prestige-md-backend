import rateLimit, { type Options } from "express-rate-limit";
import env from "~/env";
import logger from "~/lib/logger";

const limiterOptions: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
};

if (env.REDIS_URL) {
  logger.warn(
    "REDIS_URL is set, but Redis is unreachable from this environment. Rate limiting will use the in-memory store.",
  );
} else {
  logger.warn("REDIS_URL is not set; rate limiting will use in-memory store.");
}

export const limiter = rateLimit(limiterOptions);
