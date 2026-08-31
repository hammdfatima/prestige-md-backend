import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import {
  FORGOT_PASSWORD_MESSAGE,
  RESEND_LOGIN_OTP_MESSAGE,
} from "~/lib/anti-enumeration";
import { auditContextFromRequest } from "~/lib/audit-request-context";
import { recordPasswordChangedForAuth } from "~/lib/auth-audit";
import { getRequestIp, getRequestUserAgent } from "~/lib/request-ip";
import { getAuthUser } from "~/middlewares/auth";
import type {
  ChangePasswordBody,
  FacilityInviteQuery,
  ForgotPasswordBody,
  LoginBody,
  ReportLoginBody,
  ResendLoginOtpBody,
  ResetPasswordBody,
  SetFacilityPasswordBody,
  UpdateAvailabilityBody,
  UpdateMeBody,
  VerifyLoginOtpBody,
} from "~/schemas/auth-schemas";
import * as authService from "~/services/auth-service";
import { reportSuspiciousLogin } from "~/services/login-notification-service";
import type { StepUpBody } from "~/schemas/step-up-schemas";
import { verifyStepUpPassword } from "~/services/step-up-auth-service";
import * as meService from "~/services/me-service";
import {
  acceptInContextConsent,
  getDoctorInContextConsentStatus,
} from "~/services/in-context-consent-service";
import type { AcceptInContextConsentBody } from "~/schemas/in-context-consent-schemas";
import {
  idleLogout,
  listActiveAccountSessions,
  refreshSessionActivity,
  revokeOtherAccountSessions,
} from "~/services/session-service";

export const loginHandler = asyncHandler<LoginBody>(async (req, res) => {
  const data = await authService.login(req.body, {
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  });

  if (data.mfaRequired) {
    return res.status(HttpStatus.OK).json({
      message: "Verification code sent to your email",
      data,
    });
  }

  return res.status(HttpStatus.OK).json({
    message: "Logged in successfully",
    data,
  });
});

export const verifyLoginOtpHandler = asyncHandler<VerifyLoginOtpBody>(
  async (req, res) => {
    const data = await authService.verifyLoginOtp(req.body, {
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    });

    return res.status(HttpStatus.OK).json({
      message: "Logged in successfully",
      data,
    });
  },
);

export const resendLoginOtpHandler = asyncHandler<ResendLoginOtpBody>(
  async (req, res) => {
    const data = await authService.resendLoginOtp(req.body, {
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    });

    return res.status(HttpStatus.OK).json({
      message: RESEND_LOGIN_OTP_MESSAGE,
      data,
    });
  },
);

export const reportLoginHandler = asyncHandler<ReportLoginBody>(
  async (req, res) => {
    const data = await reportSuspiciousLogin(req.body.token);

    return res.status(HttpStatus.OK).json({
      message:
        "All active sessions were signed out and a password reset link was sent to your email.",
      data,
    });
  },
);

export const forgotPasswordHandler = asyncHandler<ForgotPasswordBody>(
  async (req, res) => {
    await authService.forgotPassword(req.body, auditContextFromRequest(req));
    return res.status(HttpStatus.OK).json({
      message: FORGOT_PASSWORD_MESSAGE,
    });
  },
);

export const resetPasswordHandler = asyncHandler<ResetPasswordBody>(
  async (req, res) => {
    await authService.resetPassword(req.body, auditContextFromRequest(req));
    return res.status(HttpStatus.OK).json({
      message: "Password updated successfully. You can sign in now.",
    });
  },
);

export const getFacilityInviteHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  FacilityInviteQuery
>(async (req, res) => {
  const data = await authService.getFacilityInvite(String(req.query.token ?? ""));
  return res.status(HttpStatus.OK).json({
    message: "Invite is valid",
    data,
  });
});

export const setFacilityPasswordHandler = asyncHandler<SetFacilityPasswordBody>(
  async (req, res) => {
    const data = await authService.setFacilityPassword(
      req.body,
      auditContextFromRequest(req),
    );
    return res.status(HttpStatus.OK).json({
      message: "Password set successfully",
      data,
    });
  },
);

export const getMeHandler = asyncHandler(async (req, res) => {
  const data = await meService.getMe(getAuthUser(req));
  return res.status(HttpStatus.OK).json({
    message: "Profile fetched successfully",
    data,
  });
});

export const getInContextConsentHandler = asyncHandler(async (req, res) => {
  const auth = getAuthUser(req);
  const data = await getDoctorInContextConsentStatus(auth.id);
  return res.status(HttpStatus.OK).json({
    message: "In-context consent status fetched successfully",
    data,
  });
});

export const acceptInContextConsentHandler = asyncHandler<
  AcceptInContextConsentBody
>(async (req, res) => {
  const data = await acceptInContextConsent(getAuthUser(req), req.body.consentType, {
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  });
  return res.status(HttpStatus.OK).json({
    message: "Consent recorded successfully",
    data,
  });
});

export const updateMeHandler = asyncHandler<UpdateMeBody>(async (req, res) => {
  const data = await meService.updateMe(getAuthUser(req), req.body);
  return res.status(HttpStatus.OK).json({
    message: "Profile updated successfully",
    data,
  });
});

export const updateAvailabilityHandler = asyncHandler<
  UpdateAvailabilityBody
>(async (req, res) => {
  const data = await meService.updateAvailability(getAuthUser(req), req.body);
  return res.status(HttpStatus.OK).json({
    message: data.isAvailable
      ? "You are now available for calls"
      : "You are now unavailable for new patients",
    data,
  });
});

export const changePasswordHandler = asyncHandler<ChangePasswordBody>(
  async (req, res) => {
    const auditContext = auditContextFromRequest(req);
    const data = await meService.changePassword(getAuthUser(req), req.body);
    await recordPasswordChangedForAuth(getAuthUser(req), auditContext);
    return res.status(HttpStatus.OK).json({
      message: "Password updated successfully",
      data,
    });
  },
);

export const stepUpHandler = asyncHandler<StepUpBody>(async (req, res) => {
  const data = await verifyStepUpPassword(getAuthUser(req), req.body.password, {
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    action: req.body.action,
  });

  return res.status(HttpStatus.OK).json({
    message: "Identity verified",
    data,
  });
});

export const heartbeatSessionHandler = asyncHandler(async (req, res) => {
  const data = await refreshSessionActivity(getAuthUser(req));
  return res.status(HttpStatus.OK).json({
    message: "Session extended",
    data,
  });
});

export const idleLogoutSessionHandler = asyncHandler(async (req, res) => {
  await idleLogout(getAuthUser(req));
  return res.status(HttpStatus.OK).json({
    message: "Session ended due to inactivity",
  });
});

export const listSessionsHandler = asyncHandler(async (req, res) => {
  const data = await listActiveAccountSessions(getAuthUser(req));
  return res.status(HttpStatus.OK).json({
    message: "Active sessions fetched successfully",
    data,
  });
});

export const revokeOtherSessionsHandler = asyncHandler(async (req, res) => {
  await revokeOtherAccountSessions(getAuthUser(req));
  return res.status(HttpStatus.OK).json({
    message: "All other devices were signed out",
  });
});
