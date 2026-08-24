import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import type {
  ChangePasswordBody,
  CreateAdminBody,
  FacilityInviteQuery,
  ForgotPasswordBody,
  LoginBody,
  ResetPasswordBody,
  SetFacilityPasswordBody,
  UpdateAvailabilityBody,
  UpdateMeBody,
} from "~/schemas/auth-schemas";
import * as authService from "~/services/auth-service";
import * as meService from "~/services/me-service";

export const loginHandler = asyncHandler<LoginBody>(async (req, res) => {
  const data = await authService.login(req.body);
  return res.status(HttpStatus.OK).json({
    message: "Logged in successfully",
    data,
  });
});

export const forgotPasswordHandler = asyncHandler<ForgotPasswordBody>(
  async (req, res) => {
    await authService.forgotPassword(req.body);
    return res.status(HttpStatus.OK).json({
      message:
        "If an account exists for this email, a password reset code has been sent",
    });
  },
);

export const resetPasswordHandler = asyncHandler<ResetPasswordBody>(
  async (req, res) => {
    await authService.resetPassword(req.body);
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
    const data = await authService.setFacilityPassword(req.body);
    return res.status(HttpStatus.OK).json({
      message: "Password set successfully",
      data,
    });
  },
);

export const createAdminHandler = asyncHandler<CreateAdminBody>(
  async (req, res) => {
    const data = await authService.createAdmin(req.body);
    return res.status(HttpStatus.CREATED).json({
      message: "Admin created successfully",
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
    const data = await meService.changePassword(getAuthUser(req), req.body);
    return res.status(HttpStatus.OK).json({
      message: "Password updated successfully",
      data,
    });
  },
);
