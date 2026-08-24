import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "~/env";
import errorHandle from "~/middlewares/error-handler";
import logger from "~/lib/logger";
import MAIN_ROUTER from "~/v1/routes/index";
import { initSocket } from "~/lib/socket";
import prisma from "./lib/db";
import { configureCloudinary } from "./lib/cloudinary";
import { limiter } from "./middlewares/rate-limiter";
import { startKeepAliveJob } from "./jobs/keep-alive-job";
import { startVisitReminderJob } from "./jobs/visit-reminder-job";

const app = express();

const server = createServer(app);

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
    origin: env.APP_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(limiter);

app.use(
  helmet({
    frameguard: { action: "deny" }, // Prevent click jacking
    referrerPolicy: { policy: "no-referrer" }, // Hide referrer information
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, //HSTS header to force the use of HTTPS.
    noSniff: true, //Prevent Sniffing of MIME Types
  }),
);

app.disable("x-powered-by"); //reduce fingerprinting

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", MAIN_ROUTER);

// Error handler middleware
app.use(errorHandle);

/* eslint-disable node/no-process-env */
const port = Number(process.env.PORT) || env.PORT_NO;
/* eslint-enable node/no-process-env */

// Start the server
server.listen(port, () => {
  logger.info(`Server started on port :${port}`);
  initSocket(server);
  configureCloudinary();
  startVisitReminderJob();
  startKeepAliveJob();
  prisma.$connect().then(() => {
    logger.info("Connected to the database successfully!");
  });
});
