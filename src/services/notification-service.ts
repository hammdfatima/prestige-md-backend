import type { Notification, NotificationType } from "~/generated/prisma/client"
import { UserRole, UserStatus } from "~/generated/prisma/client"
import prisma from "~/lib/db"
import { emitNotification } from "~/lib/socket"
import type { TokenPayload } from "~/types"

export type PublicNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  href: string
  visitId: string | null
  read: boolean
  createdAt: string
}

export type NotificationInput = {
  recipientId: string
  type: NotificationType
  title: string
  body: string
  href: string
  visitId?: string | null
}

function toPublic(notification: Notification): PublicNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    visitId: notification.visitId,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }
}

export async function createNotification(
  input: NotificationInput,
): Promise<PublicNotification> {
  const notification = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      visitId: input.visitId ?? null,
    },
  })

  const payload = toPublic(notification)
  emitNotification(input.recipientId, payload)
  return payload
}

export async function createNotifications(items: NotificationInput[]) {
  if (items.length === 0) return []

  const unique = items.filter(
    (item, index, list) =>
      list.findIndex((other) => other.recipientId === item.recipientId) ===
      index,
  )

  return Promise.all(unique.map((item) => createNotification(item)))
}

export async function listNotifications(auth: TokenPayload) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: auth.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  })

  return notifications.map(toPublic)
}

export async function markNotificationRead(
  auth: TokenPayload,
  notificationId: string,
) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, recipientId: auth.id },
  })

  if (!existing) {
    return null
  }

  if (existing.readAt) {
    return toPublic(existing)
  }

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  })

  return toPublic(updated)
}

export async function markAllNotificationsRead(auth: TokenPayload) {
  await prisma.notification.updateMany({
    where: { recipientId: auth.id, readAt: null },
    data: { readAt: new Date() },
  })

  return listNotifications(auth)
}

/** Active admin + team-member accounts for org-wide visit alerts. */
export async function listAdminRecipientIds() {
  const users = await prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      role: { in: [UserRole.ADMIN, UserRole.TEAM_MEMBER] },
      passwordSetAt: { not: null },
    },
    select: { id: true },
  })

  return users.map((user) => user.id)
}
