/** HIPAA §7.3 API rate limiting — global, login, and export throttles. */
import Redis from "ioredis";
import rateLimit, { type Options, type Store } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { status as HttpStatus } from "http-status";
import env from "~/env";
import logger from "~/lib/logger";

function rateLimitHandler(message: string) {
  return (
    _req: unknown,
    res: { status: (code: number) => { json: (body: unknown) => void } },
  ) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message,
      },
    });
  };
}

let redisClient: Redis | null = null;
let rateLimitStore: Store | undefined;

function getRateLimitStore(): Store | undefined {
  if (!env.REDIS_URL) {
    return undefined;
  }

  if (!rateLimitStore) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (error) => {
      logger.error("Redis rate-limit client error");
      logger.error(error);
    });

    rateLimitStore = new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        redisClient!.call(command, ...args) as Promise<RedisReply>,
    });

    logger.info("Rate limiting will use the Redis store.");
  }

  return rateLimitStore;
}

function createLimiterOptions(
  message: string,
  overrides: Partial<Options> = {},
): Partial<Options> {
  const store = getRateLimitStore();

  if (!store) {
    logger.warn("REDIS_URL is not set; rate limiting will use the in-memory store.");
  }

  return {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler(message),
    ...(store ? { store } : {}),
    ...overrides,
  };
}

export const limiter = rateLimit(
  createLimiterOptions(
    "Too many requests from this IP, please try again later.",
  ),
);

export const authLoginLimiter = rateLimit(
  createLimiterOptions(
    "Too many login attempts from this IP, please try again later.",
    { max: 30 },
  ),
);

export const patientExportLimiter = rateLimit(
  createLimiterOptions(
    "Too many patient export requests. Try again later.",
    { windowMs: 60 * 60 * 1000, max: 5 },
  ),
);
