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

const app = express();

const server = createServer(app);

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

// Start the server
server.listen(env.PORT_NO, () => {
  logger.info(`Server started on port :${env.PORT_NO}`);
  initSocket(server);
  configureCloudinary();
  prisma.$connect().then(() => {
    logger.info("Connected to the database successfully!");
  });
});
