import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { UserRole } from "~/generated/prisma/client";
import { getAppBaseUrl } from "~/lib/app-url";
import prisma from "~/lib/db";
import { verifyToken } from "~/lib/jwt";
import { validateSessionToken } from "~/lib/validate-session-token";
import { assertVisitAccessForViewer } from "~/services/visit-service";
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
  auth: TokenPayload;
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
  const { auth } = socket.data as SocketAuthData;
  if (auth.role !== UserRole.DOCTOR) {
    return;
  }

  cancelDoctorOfflineTimer(auth.id);
  doctorConnectionCounts.set(
    auth.id,
    (doctorConnectionCounts.get(auth.id) ?? 0) + 1,
  );

  socket.on("disconnect", () => {
    const remaining = (doctorConnectionCounts.get(auth.id) ?? 1) - 1;
    if (remaining <= 0) {
      doctorConnectionCounts.delete(auth.id);
      scheduleDoctorOffline(auth.id);
      return;
    }
    doctorConnectionCounts.set(auth.id, remaining);
  });
}

async function assertVisitSocketAccess(socket: Socket, visitId: string) {
  const { auth } = socket.data as SocketAuthData;
  await assertVisitAccessForViewer(auth, visitId);
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: getAppBaseUrl(),
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
      const payload = verifyToken(token) as ReturnType<typeof verifyToken> & {
        iat?: number;
      };
      const auth = await validateSessionToken(payload);
      (socket.data as SocketAuthData).auth = auth;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const { auth } = socket.data as SocketAuthData;
    socket.join("staff");
    socket.join(`user:${auth.id}`);

    socket.on("visit:join", (visitId: unknown) => {
      if (typeof visitId !== "string" || !visitId.trim()) return;
      void assertVisitSocketAccess(socket, visitId)
        .then(() => {
          socket.join(`visit:${visitId}`);
        })
        .catch(() => {
          // Out-of-scope visit IDs are ignored (§16.2).
        });
    });

    socket.on("visit:leave", (visitId: unknown) => {
      if (typeof visitId !== "string" || !visitId.trim()) return;
      socket.leave(`visit:${visitId}`);
    });

    socket.on("visit:typing", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as { visitId?: unknown; isTyping?: unknown };
      if (typeof data.visitId !== "string" || !data.visitId.trim()) return;

      void assertVisitSocketAccess(socket, data.visitId)
        .then(() => {
          socket.to(`visit:${data.visitId}`).emit("visit:typing", {
            visitId: data.visitId,
            userId: auth.id,
            isTyping: Boolean(data.isTyping),
          });
        })
        .catch(() => {
          // Out-of-scope visit IDs are ignored (§16.2).
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
