import { Router } from "express";
import { UserRole } from "~/generated/prisma/client";
import {
  requireAdmin,
  requireAuth,
  requirePermission,
} from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  listProvidersQuerySchema,
  providerIdParamsSchema,
} from "~/schemas/provider-schemas";
import {
  blockProviderHandler,
  createProviderHandler,
  listAvailableProvidersHandler,
  listProvidersHandler,
  unblockProviderHandler,
} from "~/v1/routes/provider/provider-handlers";

const PROVIDER_ROUTER = Router();

PROVIDER_ROUTER.get(
  "/available",
  requireAuth(
    UserRole.NURSE,
    UserRole.ADMIN,
    UserRole.TEAM_MEMBER,
    UserRole.DOCTOR,
  ),
  listAvailableProvidersHandler,
);

PROVIDER_ROUTER.use(requireAdmin, requirePermission("manage_doctors"));

PROVIDER_ROUTER.post("/", createProviderHandler);

PROVIDER_ROUTER.get(
  "/",
  schemaParseMiddleWare(listProvidersQuerySchema, "query"),
  listProvidersHandler,
);

PROVIDER_ROUTER.patch(
  "/:id/block",
  schemaParseMiddleWare(providerIdParamsSchema, "params"),
  blockProviderHandler,
);

PROVIDER_ROUTER.patch(
  "/:id/unblock",
  schemaParseMiddleWare(providerIdParamsSchema, "params"),
  unblockProviderHandler,
);

export default PROVIDER_ROUTER;
