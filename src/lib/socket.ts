import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { UserRole } from "~/generated/prisma/client";
import env from "~/env";
import prisma from "~/lib/db";
import { verifyToken } from "~/lib/jwt";
import logger from "~/lib/logger";
import type { TokenPayload } from "~/types";

let io: Server | null = null;

const doctorConnectionCounts = new Map<string, number>();
const doctorOfflineTimers = new Map<string, NodeJS.Timeout>();

/** Brief grace so a page refresh does not immediately clear availability. */
const DOCTOR_OFFLINE_GRACE_MS = 8_000;

export type ProviderAvailabilityPayload = {
  id: string;
  name: string;
  specialty: string | null;
  avatarUrl: string | null;
  availability: string | null;
  isAvailable: boolean;
};

type SocketAuthData = {
  userId: string;
  role: TokenPayload["role"];
};

async function markDoctorUnavailable(doctorId: string) {
  const doctor = await prisma.user.findFirst({
    where: {
      id: doctorId,
      role: UserRole.DOCTOR,
      isAvailable: true,
    },
  });

  if (!doctor) {
    return;
  }

  const updated = await prisma.user.update({
    where: { id: doctor.id },
    data: { isAvailable: false },
  });

  emitProviderAvailability({
    id: updated.id,
    name: `${updated.firstName} ${updated.lastName}`.trim(),
    specialty: updated.specialty,
    avatarUrl: updated.avatarUrl,
    availability: updated.availability,
    isAvailable: false,
  });

  logger.info(`Provider ${updated.id} marked unavailable (session ended)`);
}

function cancelDoctorOfflineTimer(doctorId: string) {
  const timer = doctorOfflineTimers.get(doctorId);
  if (timer) {
    clearTimeout(timer);
    doctorOfflineTimers.delete(doctorId);
  }
}

function scheduleDoctorOffline(doctorId: string) {
  cancelDoctorOfflineTimer(doctorId);
  const timer = setTimeout(() => {
    doctorOfflineTimers.delete(doctorId);
    if ((doctorConnectionCounts.get(doctorId) ?? 0) > 0) {
      return;
    }
    void markDoctorUnavailable(doctorId);
  }, DOCTOR_OFFLINE_GRACE_MS);
  doctorOfflineTimers.set(doctorId, timer);
}

function trackDoctorConnection(socket: Socket) {
  const { userId, role } = socket.data as SocketAuthData;
  if (role !== UserRole.DOCTOR) {
    return;
  }

  cancelDoctorOfflineTimer(userId);
  doctorConnectionCounts.set(
    userId,
    (doctorConnectionCounts.get(userId) ?? 0) + 1,
  );

  socket.on("disconnect", () => {
    const remaining = (doctorConnectionCounts.get(userId) ?? 1) - 1;
    if (remaining <= 0) {
      doctorConnectionCounts.delete(userId);
      scheduleDoctorOffline(userId);
      return;
    }
    doctorConnectionCounts.set(userId, remaining);
  });
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: env.APP_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      const payload = verifyToken(token);
      let role = payload.role;

      if (!role) {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { role: true },
        });
        role = user?.role ?? payload.role;
      }

      if (!role) {
        next(new Error("Invalid or expired token"));
        return;
      }

      (socket.data as SocketAuthData).userId = payload.id;
      (socket.data as SocketAuthData).role = role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data as SocketAuthData;
    socket.join("staff");
    socket.join(`user:${userId}`);

    socket.on("visit:join", (visitId: unknown) => {
      if (typeof visitId !== "string" || !visitId.trim()) return;
      socket.join(`visit:${visitId}`);
    });

    socket.on("visit:leave", (visitId: unknown) => {
      if (typeof visitId !== "string" || !visitId.trim()) return;
      socket.leave(`visit:${visitId}`);
    });

    socket.on("visit:typing", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as { visitId?: unknown; isTyping?: unknown };
      if (typeof data.visitId !== "string" || !data.visitId.trim()) return;

      socket.to(`visit:${data.visitId}`).emit("visit:typing", {
        visitId: data.visitId,
        userId,
        isTyping: Boolean(data.isTyping),
      });
    });

    trackDoctorConnection(socket);
  });

  logger.info("Socket.io ready");
  return io;
}

export function emitVisitMessage(visitId: string, message: unknown) {
  io?.to(`visit:${visitId}`).emit("visit:message", message);
}

export function emitVisitUnread(payload: {
  visitId: string;
  userId: string;
  count: number;
}) {
  io?.to(`user:${payload.userId}`).emit("visit:unread", {
    visitId: payload.visitId,
    count: payload.count,
  });
  if (payload.count === 0) {
    io?.to(`user:${payload.userId}`).emit("visit:unread-cleared", {
      visitId: payload.visitId,
    });
  }
}

export function emitProviderAvailability(payload: ProviderAvailabilityPayload) {
  io?.to("staff").emit("provider:availability", payload);
}

export function emitNotification(userId: string, notification: unknown) {
  io?.to(`user:${userId}`).emit("notification:new", notification);
}

/** Cancels a pending offline mark (e.g. doctor reconnected or toggled available). */
export function cancelDoctorOfflineGrace(doctorId: string) {
  cancelDoctorOfflineTimer(doctorId);
}

/** Used on logout so availability clears immediately (no grace period). */
export async function clearDoctorAvailabilityNow(doctorId: string) {
  cancelDoctorOfflineTimer(doctorId);
  doctorConnectionCounts.delete(doctorId);
  await markDoctorUnavailable(doctorId);
}
