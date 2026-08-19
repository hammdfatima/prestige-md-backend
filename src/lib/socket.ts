import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import env from "~/env";
import { verifyToken } from "~/lib/jwt";
import logger from "~/lib/logger";

let io: Server | null = null;

export type ProviderAvailabilityPayload = {
  id: string;
  name: string;
  specialty: string | null;
  avatarUrl: string | null;
  availability: string | null;
  isAvailable: boolean;
};

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: env.APP_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      verifyToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("staff");
  });

  logger.info("Socket.io ready");
  return io;
}

export function emitProviderAvailability(payload: ProviderAvailabilityPayload) {
  io?.to("staff").emit("provider:availability", payload);
}
