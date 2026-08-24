import { Router } from "express";
import { UserRole } from "~/generated/prisma/client";
import { requireAuth, requireDoctor, requireNurse } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  createVisitSchema,
  listVisitsQuerySchema,
  sendVisitMessageSchema,
  updateVisitNotesSchema,
  visitIdParamsSchema,
} from "~/schemas/visit-schemas";
import {
  cancelVisitHandler,
  completeVisitHandler,
  createVisitHandler,
  getVisitHandler,
  getVisitUnreadCountHandler,
  joinVisitHandler,
  leaveVisitHandler,
  listVisitMessagesHandler,
  listVisitsHandler,
  sendVisitMessageHandler,
  updateVisitNotesHandler,
} from "~/v1/routes/visit/visit-handlers";

const VISIT_ROUTER = Router();

VISIT_ROUTER.get(
  "/",
  requireAuth(
    UserRole.NURSE,
    UserRole.DOCTOR,
    UserRole.ADMIN,
    UserRole.TEAM_MEMBER,
    UserRole.FACILITY_MANAGER,
  ),
  schemaParseMiddleWare(listVisitsQuerySchema, "query"),
  listVisitsHandler,
);

VISIT_ROUTER.get(
  "/:id",
  requireAuth(
    UserRole.NURSE,
    UserRole.DOCTOR,
    UserRole.ADMIN,
    UserRole.TEAM_MEMBER,
    UserRole.FACILITY_MANAGER,
  ),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  getVisitHandler,
);

VISIT_ROUTER.post(
  "/",
  requireNurse,
  schemaParseMiddleWare(createVisitSchema),
  createVisitHandler,
);

VISIT_ROUTER.post(
  "/:id/join",
  requireAuth(UserRole.DOCTOR, UserRole.NURSE),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  joinVisitHandler,
);

VISIT_ROUTER.post(
  "/:id/leave",
  requireAuth(UserRole.DOCTOR, UserRole.NURSE),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  leaveVisitHandler,
);

VISIT_ROUTER.patch(
  "/:id/notes",
  requireDoctor,
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  schemaParseMiddleWare(updateVisitNotesSchema),
  updateVisitNotesHandler,
);

VISIT_ROUTER.post(
  "/:id/complete",
  requireDoctor,
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  completeVisitHandler,
);

VISIT_ROUTER.post(
  "/:id/cancel",
  requireNurse,
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  cancelVisitHandler,
);

VISIT_ROUTER.get(
  "/:id/messages",
  requireAuth(UserRole.DOCTOR, UserRole.NURSE),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  listVisitMessagesHandler,
);

VISIT_ROUTER.get(
  "/:id/messages/unread-count",
  requireAuth(UserRole.DOCTOR, UserRole.NURSE),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  getVisitUnreadCountHandler,
);

VISIT_ROUTER.post(
  "/:id/messages",
  requireAuth(UserRole.DOCTOR, UserRole.NURSE),
  schemaParseMiddleWare(visitIdParamsSchema, "params"),
  schemaParseMiddleWare(sendVisitMessageSchema),
  sendVisitMessageHandler,
);

export default VISIT_ROUTER;
