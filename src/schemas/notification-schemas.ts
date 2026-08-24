import { z } from "zod"

export const notificationIdParamsSchema = z.object({
  id: z.uuid("Invalid notification id"),
})

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>
