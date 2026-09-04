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
let redisStoreReadyLogged = false;

function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      // Prevent MaxRetriesPerRequestError from crashing the Node process when Redis is down.
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      retryStrategy(times) {
        if (times === 1 || times % 20 === 0) {
          logger.warn(
            `Redis unreachable (attempt ${times}); rate-limit commands will retry. Fix REDIS_URL or clear it to use in-memory limits.`,
          );
        }
        return Math.min(times * 500, 5_000);
      },
    });

    redisClient.on("error", (error) => {
      logger.error("Redis rate-limit client error");
      logger.error(error);
    });

    redisClient.on("connect", () => {
      logger.info("Redis rate-limit client connected");
    });
  }

  return redisClient;
}

/**
 * express-rate-limit forbids sharing one Store across limiters.
 * Share the Redis client, but create a dedicated RedisStore + unique prefix per limiter.
 */
function createRedisStore(prefix: string): Store | undefined {
  const client = getRedisClient();
  if (!client) {
    return undefined;
  }

  if (!redisStoreReadyLogged) {
    logger.info("Rate limiting will use the Redis store.");
    redisStoreReadyLogged = true;
  }

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<RedisReply>,
  });
}

function createLimiterOptions(
  message: string,
  storePrefix: string,
  overrides: Partial<Options> = {},
): Partial<Options> {
  const store = createRedisStore(storePrefix);

  if (!store) {
    logger.warn(
      `REDIS_URL is not set; "${storePrefix}" rate limiting will use the in-memory store.`,
    );
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
    "global",
  ),
);

export const authLoginLimiter = rateLimit(
  createLimiterOptions(
    "Too many login attempts from this IP, please try again later.",
    "auth-login",
    { max: 30 },
  ),
);

export const patientExportLimiter = rateLimit(
  createLimiterOptions(
    "Too many patient export requests. Try again later.",
    "patient-export",
    { windowMs: 60 * 60 * 1000, max: 5 },
  ),
);
