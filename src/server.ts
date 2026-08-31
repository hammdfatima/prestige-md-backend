import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { sanitizeLogMessage } from "~/lib/sanitize-for-log";
import env from "~/env";
import { getAppBaseUrl } from "~/lib/app-url";
import { getHelmetOptions } from "~/lib/security-headers";
import errorHandle from "~/middlewares/error-handler";
import { apiResponseEnvelopeMiddleware } from "~/middlewares/api-response-envelope";
import { httpsRedirect } from "~/middlewares/https-redirect";
import logger from "~/lib/logger";
import MAIN_ROUTER from "~/v1/routes/index";
import { initSocket } from "~/lib/socket";
import prisma from "./lib/db";
import { ensureSecurityAuditAppendOnlyGuards } from "./lib/security-audit-db-guards";
import { configureCloudinary } from "./lib/cloudinary";
import { ensureCloudinaryUploadPolicy } from "./lib/cloudinary-policy-setup";
import { limiter } from "./middlewares/rate-limiter";
import { startVisitReminderJob } from "./jobs/visit-reminder-job";
import { startRetentionJob } from "./jobs/retention-job";
import { initializeKeyManagement } from "./lib/key-management";

const app = express();

const server = createServer(app);

app.set("trust proxy", 1);

app.use(httpsRedirect);
app.use(helmet(getHelmetOptions()));
app.disable("x-powered-by");

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "prestige-md-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "prestige-md-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use(
  cors({
    origin: getAppBaseUrl(),
    credentials: true,
  }),
);

app.use(limiter);

app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: {
      write: (message) => {
        logger.info(sanitizeLogMessage(message.trim()));
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apiResponseEnvelopeMiddleware);

// Versioned API — /api/v1 is canonical; /api is a backward-compatible alias.
app.use("/api/v1", MAIN_ROUTER);
app.use("/api", MAIN_ROUTER);

// Error handler middleware
app.use(errorHandle);

/* eslint-disable node/no-process-env */
const port = Number(process.env.PORT) || env.PORT_NO;
/* eslint-enable node/no-process-env */

async function start() {
  await prisma.$connect();
  logger.info("Connected to the database successfully!");
  await initializeKeyManagement();
  await ensureSecurityAuditAppendOnlyGuards();

  server.listen(port, () => {
    logger.info(`Server started on port :${port}`);
    initSocket(server);
    configureCloudinary();
    void ensureCloudinaryUploadPolicy().catch((error) => {
      logger.warn("Cloudinary upload policy setup skipped:", error);
    });
    startVisitReminderJob();
    startRetentionJob();
  });
}

void start().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
