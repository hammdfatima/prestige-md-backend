import { Router } from "express";
import {
  changePasswordSchema,
  facilityInviteQuerySchema,
  forgotPasswordSchema,
  loginSchema,
  setFacilityPasswordSchema,
  updateAvailabilitySchema,
  updateMeSchema,
} from "~/schemas/auth-schemas";
import { requireAuth, requireDoctor } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  getFacilityInviteHandler,
  getMeHandler,
  loginHandler,
  setFacilityPasswordHandler,
  updateAvailabilityHandler,
  updateMeHandler,
} from "~/v1/routes/auth/auth-handlers";

const AUTH_ROUTER = Router();

AUTH_ROUTER.post("/login", schemaParseMiddleWare(loginSchema), loginHandler);

AUTH_ROUTER.post(
  "/forgot-password",
  schemaParseMiddleWare(forgotPasswordSchema),
  forgotPasswordHandler,
);

AUTH_ROUTER.get(
  "/facility-invite",
  schemaParseMiddleWare(facilityInviteQuerySchema, "query"),
  getFacilityInviteHandler,
);

AUTH_ROUTER.post(
  "/set-password",
  schemaParseMiddleWare(setFacilityPasswordSchema),
  setFacilityPasswordHandler,
);

AUTH_ROUTER.get("/me", requireAuth(), getMeHandler);

AUTH_ROUTER.patch(
  "/me",
  requireAuth(),
  schemaParseMiddleWare(updateMeSchema),
  updateMeHandler,
);

AUTH_ROUTER.patch(
  "/availability",
  requireDoctor,
  schemaParseMiddleWare(updateAvailabilitySchema),
  updateAvailabilityHandler,
);

AUTH_ROUTER.patch(
  "/password",
  requireAuth(),
  schemaParseMiddleWare(changePasswordSchema),
  changePasswordHandler,
);

/**
 * One-time admin seed. Uncomment the route below (and the imports) to create
 * the first admin, then comment it again.
 *
 * import { createAdminSchema } from "~/schemas/auth-schemas";
 * import { createAdminHandler } from "~/v1/routes/auth/auth-handlers";
 *
 * AUTH_ROUTER.post(
 *   "/register-admin",
 *   schemaParseMiddleWare(createAdminSchema),
 *   createAdminHandler,
 * );
 */

export default AUTH_ROUTER;
