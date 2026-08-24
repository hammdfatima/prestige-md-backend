import { status as HttpStatus } from "http-status"
import { asyncHandler } from "~/lib/async-handler"
import { getAuthUser } from "~/middlewares/auth"
import { HttpError } from "~/middlewares/error-handler"
import type { NotificationIdParams } from "~/schemas/notification-schemas"
import * as notificationService from "~/services/notification-service"

export const listNotificationsHandler = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications(getAuthUser(req))
  return res.status(HttpStatus.OK).json({
    message: "Notifications fetched successfully",
    data,
  })
})

export const markNotificationReadHandler = asyncHandler<
  Record<string, never>,
  NotificationIdParams
>(async (req, res) => {
  const data = await notificationService.markNotificationRead(
    getAuthUser(req),
    req.params.id,
  )

  if (!data) {
    throw new HttpError("Notification not found", HttpStatus.NOT_FOUND)
  }

  return res.status(HttpStatus.OK).json({
    message: "Notification marked as read",
    data,
  })
})

export const markAllNotificationsReadHandler = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllNotificationsRead(
    getAuthUser(req),
  )
  return res.status(HttpStatus.OK).json({
    message: "All notifications marked as read",
    data,
  })
})
