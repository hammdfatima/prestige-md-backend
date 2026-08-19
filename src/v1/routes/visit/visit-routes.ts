import { Router } from "express";
import { requireAuth, requireNurse } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  createVisitSchema,
  listVisitsQuerySchema,
  visitIdParamsSchema,
} from "~/schemas/visit-schemas";
import {
  createVisitHandler,
  getVisitHandler,
  listVisitsHandler,
} from "~/v1/routes/visit/visit-handlers";
import { UserRole } from "~/generated/prisma/client";

const VISIT_ROUTER = Router();

VISIT_ROUTER.get(
  "/",
  requireAuth(
    UserRole.NURSE,
    UserRole.DOCTOR,
    UserRole.ADMIN,
    UserRole.TEAM_MEMBER,
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

export default VISIT_ROUTER;
