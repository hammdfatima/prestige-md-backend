import { Router } from "express";
import { requireAdmin, requirePermission } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  createFacilitySchema,
  facilityIdParamsSchema,
  listFacilitiesQuerySchema,
} from "~/schemas/facility-schemas";
import {
  blockFacilityHandler,
  createFacilityHandler,
  listFacilitiesHandler,
  resendFacilityInviteHandler,
  unblockFacilityHandler,
} from "~/v1/routes/facility/facility-handlers";

const FACILITY_ROUTER = Router();

FACILITY_ROUTER.use(requireAdmin);

FACILITY_ROUTER.post(
  "/",
  requirePermission("manage_facilities"),
  schemaParseMiddleWare(createFacilitySchema),
  createFacilityHandler,
);

FACILITY_ROUTER.get(
  "/",
  requirePermission(
    "manage_facilities",
    "manage_nurses",
    "manage_doctors",
    "manage_patients",
  ),
  schemaParseMiddleWare(listFacilitiesQuerySchema, "query"),
  listFacilitiesHandler,
);

FACILITY_ROUTER.patch(
  "/:id/block",
  requirePermission("manage_facilities"),
  schemaParseMiddleWare(facilityIdParamsSchema, "params"),
  blockFacilityHandler,
);

FACILITY_ROUTER.patch(
  "/:id/unblock",
  requirePermission("manage_facilities"),
  schemaParseMiddleWare(facilityIdParamsSchema, "params"),
  unblockFacilityHandler,
);

FACILITY_ROUTER.post(
  "/:id/resend-invite",
  requirePermission("manage_facilities"),
  schemaParseMiddleWare(facilityIdParamsSchema, "params"),
  resendFacilityInviteHandler,
);

export default FACILITY_ROUTER;
