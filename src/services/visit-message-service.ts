import { status as HttpStatus } from "http-status";
import { UserRole, type User } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { notifyVisitMessageInApp } from "~/lib/notifications/visit-notifications";
import { emitVisitMessage, emitVisitUnread } from "~/lib/socket";
import { HttpError } from "~/middlewares/error-handler";
import { assertCallerOwnsObjectKey } from "~/lib/object-key-ownership";
import type { SendVisitMessageBody } from "~/schemas/visit-schemas";
import { getVisit } from "~/services/visit-service";
import type { TokenPayload } from "~/types";

const messageInclude = {
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
    },
  },
} as const;

function publicSenderRole(role: UserRole) {
  if (role === UserRole.DOCTOR) return "DOCTOR" as const;
  if (role === UserRole.NURSE) return "NURSE" as const;
  return "STAFF" as const;
}

function publicMessage(
  message: {
    id: string;
    visitId: string;
    body: string;
    createdAt: Date;
    readAt: Date | null;
    attachmentUrl: string | null;
    attachmentPublicId: string | null;
    attachmentMimeType: string | null;
    attachmentFilename: string | null;
    attachmentBytes: number | null;
    sender: Pick<
      User,
      "id" | "firstName" | "lastName" | "role" | "avatarUrl"
    >;
  },
  viewerId: string,
) {
  const hasAttachment = Boolean(
    message.attachmentUrl &&
      message.attachmentPublicId &&
      message.attachmentMimeType &&
      message.attachmentFilename,
  );

  return {
    id: message.id,
    visitId: message.visitId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
    attachment: hasAttachment
      ? {
          url: message.attachmentUrl as string,
          publicId: message.attachmentPublicId as string,
          mimeType: message.attachmentMimeType as string,
          filename: message.attachmentFilename as string,
          bytes: message.attachmentBytes,
        }
      : null,
    sender: {
      id: message.sender.id,
      role: publicSenderRole(message.sender.role),
      name: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
      avatarUrl: message.sender.avatarUrl,
    },
    mine: message.sender.id === viewerId,
  };
}

async function assertCanChat(auth: TokenPayload, visitId: string) {
  if (auth.role !== UserRole.DOCTOR && auth.role !== UserRole.NURSE) {
    throw new HttpError(
      "Only doctors and nurses can use visit chat",
      HttpStatus.FORBIDDEN,
    );
  }

  // Reuses visit access rules (facility nurse / assigned doctor).
  const visit = await getVisit(auth, visitId);
  return visit;
}

async function markMessagesRead(visitId: string, viewerId: string) {
  await prisma.visitMessage.updateMany({
    where: {
      visitId,
      senderId: { not: viewerId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function listVisitMessages(auth: TokenPayload, visitId: string) {
  await assertCanChat(auth, visitId);
  await markMessagesRead(visitId, auth.id);

  const messages = await prisma.visitMessage.findMany({
    where: { visitId },
    include: messageInclude,
    orderBy: { createdAt: "asc" },
  });

  emitVisitUnread({ visitId, userId: auth.id, count: 0 });

  return messages.map((message) => publicMessage(message, auth.id));
}

export async function getVisitUnreadCount(
  auth: TokenPayload,
  visitId: string,
) {
  await assertCanChat(auth, visitId);

  const count = await prisma.visitMessage.count({
    where: {
      visitId,
      senderId: { not: auth.id },
      readAt: null,
    },
  });

  return { visitId, count };
}

export async function sendVisitMessage(
  auth: TokenPayload,
  visitId: string,
  input: SendVisitMessageBody,
) {
  const visit = await assertCanChat(auth, visitId);

  const body = input.body?.trim() ?? "";
  const attachment = input.attachment;

  if (!body && !attachment) {
    throw new HttpError(
      "Message text or attachment is required",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (attachment?.publicId) {
    assertCallerOwnsObjectKey(auth, attachment.publicId);
  }

  const message = await prisma.visitMessage.create({
    data: {
      visitId,
      senderId: auth.id,
      body,
      attachmentUrl: attachment?.url,
      attachmentPublicId: attachment?.publicId,
      attachmentMimeType: attachment?.mimeType,
      attachmentFilename: attachment?.filename,
      attachmentBytes: attachment?.bytes ?? null,
    },
    include: messageInclude,
  });

  const payload = publicMessage(message, auth.id);
  emitVisitMessage(visitId, payload);

  const counterpartId =
    auth.role === UserRole.DOCTOR ? visit.bookedBy.id : visit.provider.id;

  if (counterpartId && counterpartId !== auth.id) {
    const unread = await prisma.visitMessage.count({
      where: {
        visitId,
        senderId: { not: counterpartId },
        readAt: null,
      },
    });
    emitVisitUnread({
      visitId,
      userId: counterpartId,
      count: unread,
    });

    void notifyVisitMessageInApp({
      recipientId: counterpartId,
      recipientRole: auth.role === UserRole.DOCTOR ? "NURSE" : "DOCTOR",
      visitId,
    });
  }

  return payload;
}
