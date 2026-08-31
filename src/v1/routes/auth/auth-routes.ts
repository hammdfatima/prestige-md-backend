import { Router } from "express";
import { UserRole } from "~/generated/prisma/client";
import {
  changePasswordSchema,
  facilityInviteQuerySchema,
  forgotPasswordSchema,
  loginSchema,
  reportLoginSchema,
  resendLoginOtpSchema,
  resetPasswordSchema,
  setFacilityPasswordSchema,
  updateAvailabilitySchema,
  updateMeSchema,
  verifyLoginOtpSchema,
} from "~/schemas/auth-schemas";
import { stepUpSchema } from "~/schemas/step-up-schemas";
import { acceptInContextConsentSchema } from "~/schemas/in-context-consent-schemas";
import { requireAuth, requireAuthAllowIdle, requireDoctor } from "~/middlewares/auth";
import { authLoginLimiter } from "~/middlewares/rate-limiter";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  getFacilityInviteHandler,
  getInContextConsentHandler,
  getMeHandler,
  acceptInContextConsentHandler,
  heartbeatSessionHandler,
  idleLogoutSessionHandler,
  listSessionsHandler,
  loginHandler,
  reportLoginHandler,
  resendLoginOtpHandler,
  resetPasswordHandler,
  revokeOtherSessionsHandler,
  setFacilityPasswordHandler,
  stepUpHandler,
  updateAvailabilityHandler,
  updateMeHandler,
  verifyLoginOtpHandler,
} from "~/v1/routes/auth/auth-handlers";

const AUTH_ROUTER = Router();

AUTH_ROUTER.post(
  "/login",
  authLoginLimiter,
  schemaParseMiddleWare(loginSchema),
  loginHandler,
);

AUTH_ROUTER.post(
  "/verify-login-otp",
  authLoginLimiter,
  schemaParseMiddleWare(verifyLoginOtpSchema),
  verifyLoginOtpHandler,
);

AUTH_ROUTER.post(
  "/resend-login-otp",
  authLoginLimiter,
  schemaParseMiddleWare(resendLoginOtpSchema),
  resendLoginOtpHandler,
);

AUTH_ROUTER.post(
  "/report-login",
  authLoginLimiter,
  schemaParseMiddleWare(reportLoginSchema),
  reportLoginHandler,
);

AUTH_ROUTER.post(
  "/forgot-password",
  schemaParseMiddleWare(forgotPasswordSchema),
  forgotPasswordHandler,
);

AUTH_ROUTER.post(
  "/reset-password",
  schemaParseMiddleWare(resetPasswordSchema),
  resetPasswordHandler,
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

AUTH_ROUTER.get(
  "/me/in-context-consent",
  requireDoctor,
  getInContextConsentHandler,
);

AUTH_ROUTER.post(
  "/me/in-context-consent",
  requireDoctor,
  schemaParseMiddleWare(acceptInContextConsentSchema),
  acceptInContextConsentHandler,
);

AUTH_ROUTER.post(
  "/session/heartbeat",
  requireAuth(),
  heartbeatSessionHandler,
);

AUTH_ROUTER.post(
  "/session/idle-logout",
  requireAuthAllowIdle(),
  idleLogoutSessionHandler,
);

AUTH_ROUTER.get("/sessions", requireAuth(), listSessionsHandler);

AUTH_ROUTER.post(
  "/sessions/revoke-others",
  requireAuth(),
  revokeOtherSessionsHandler,
);

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

AUTH_ROUTER.post(
  "/step-up",
  requireAuth(UserRole.ADMIN),
  schemaParseMiddleWare(stepUpSchema),
  stepUpHandler,
);

export default AUTH_ROUTER;
