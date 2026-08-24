import { Router } from "express"
import { UserRole } from "~/generated/prisma/client"
import { requireAuth } from "~/middlewares/auth"
import { schemaParseMiddleWare } from "~/middlewares/zod-validator"
import { notificationIdParamsSchema } from "~/schemas/notification-schemas"
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from "~/v1/routes/notification/notification-handlers"

const NOTIFICATION_ROUTER = Router()

NOTIFICATION_ROUTER.use(
  requireAuth(
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.ADMIN,
    UserRole.TEAM_MEMBER,
    UserRole.FACILITY_MANAGER,
  ),
)

NOTIFICATION_ROUTER.get("/", listNotificationsHandler)

NOTIFICATION_ROUTER.post("/read-all", markAllNotificationsReadHandler)

NOTIFICATION_ROUTER.patch(
  "/:id/read",
  schemaParseMiddleWare(notificationIdParamsSchema, "params"),
  markNotificationReadHandler,
)

export default NOTIFICATION_ROUTER
