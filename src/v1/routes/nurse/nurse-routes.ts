import { Router } from "express";
import type { RequestHandler } from "express";
import { UserRole } from "~/generated/prisma/client";

import {
  requireAdmin,
  requireAuth,
  requirePermission,
} from "~/middlewares/auth";
import { multer_memory_img } from "~/middlewares/multer";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  listNursesQuerySchema,
  nurseIdParamsSchema,
} from "~/schemas/nurse-schemas";
import {
  blockNurseHandler,
  createNurseHandler,
  listNursesHandler,
  unblockNurseHandler,
} from "~/v1/routes/nurse/nurse-handlers";

const NURSE_ROUTER = Router();

NURSE_ROUTER.get(
  "/",
  requireAuth(UserRole.ADMIN, UserRole.TEAM_MEMBER, UserRole.FACILITY_MANAGER),
  schemaParseMiddleWare(listNursesQuerySchema, "query"),
  listNursesHandler,
);

NURSE_ROUTER.use(requireAdmin, requirePermission("manage_nurses"));

NURSE_ROUTER.post(
  "/",
  multer_memory_img.single("avatar") as unknown as RequestHandler,
  createNurseHandler,
);

NURSE_ROUTER.patch(
  "/:id/block",
  schemaParseMiddleWare(nurseIdParamsSchema, "params"),
  blockNurseHandler,
);

NURSE_ROUTER.patch(
  "/:id/unblock",
  schemaParseMiddleWare(nurseIdParamsSchema, "params"),
  unblockNurseHandler,
);

export default NURSE_ROUTER;
