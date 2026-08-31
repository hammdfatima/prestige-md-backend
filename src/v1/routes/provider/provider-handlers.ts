import { status as HttpStatus } from "http-status";
import { ZodError } from "zod";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import {
  createProviderSchema,
  type ListProvidersQuery,
  type ProviderIdParams,
} from "~/schemas/provider-schemas";
import * as providerService from "~/services/provider-service";

export const createProviderHandler = asyncHandler(async (req, res) => {
  try {
    const body = createProviderSchema.parse(req.body);
    const result = await providerService.createProvider(getAuthUser(req), body);
    return res.status(HttpStatus.CREATED).json({
      message: result.emailSent
        ? "Invite link sent to the provider"
        : "Provider created. Invite email could not be sent — check server logs.",
      data: result.provider,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: "Validation error",
        errors: error.issues.map((issue) => issue.message),
      });
    }
    throw error;
  }
});

export const listAvailableProvidersHandler = asyncHandler(async (_req, res) => {
  const data = await providerService.listAvailableProviders();
  return res.status(HttpStatus.OK).json({
    message: "Available providers fetched successfully",
    data,
  });
});

export const listProvidersHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListProvidersQuery
>(async (req, res) => {
  const data = await providerService.listProvidersForViewer(
    getAuthUser(req),
    req.query,
  );
  return res.status(HttpStatus.OK).json({
    message: "Providers fetched successfully",
    data,
  });
});

export const blockProviderHandler = asyncHandler<
  Record<string, never>,
  ProviderIdParams
>(async (req, res) => {
  const data = await providerService.blockProvider(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Provider blocked successfully",
    data,
  });
});

export const unblockProviderHandler = asyncHandler<
  Record<string, never>,
  ProviderIdParams
>(async (req, res) => {
  const data = await providerService.unblockProvider(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Provider unblocked successfully",
    data,
  });
});

export const resendProviderInviteHandler = asyncHandler<
  Record<string, never>,
  ProviderIdParams
>(async (req, res) => {
  const result = await providerService.resendProviderInvite(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: result.emailSent
      ? "Invite link resent to the provider"
      : "Invite could not be sent — check server logs.",
    data: result.provider,
  });
});
