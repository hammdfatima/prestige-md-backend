import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import type {
  CreateFacilityBody,
  FacilityIdParams,
  ListFacilitiesQuery,
} from "~/schemas/facility-schemas";
import * as facilityService from "~/services/facility-service";

export const createFacilityHandler = asyncHandler<CreateFacilityBody>(
  async (req, res) => {
    const result = await facilityService.createFacility(req.body);
    return res.status(HttpStatus.CREATED).json({
      message: result.emailSent
        ? "Invite link sent to the facility manager"
        : "Facility created. Invite email could not be sent — check server logs.",
      data: result.facility,
    });
  },
);

export const listFacilitiesHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListFacilitiesQuery
>(async (req, res) => {
  const data = await facilityService.listFacilities(req.query);
  return res.status(HttpStatus.OK).json({
    message: "Facilities fetched successfully",
    data,
  });
});

export const blockFacilityHandler = asyncHandler<
  Record<string, never>,
  FacilityIdParams
>(async (req, res) => {
  const data = await facilityService.blockFacility(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Facility blocked successfully",
    data,
  });
});

export const unblockFacilityHandler = asyncHandler<
  Record<string, never>,
  FacilityIdParams
>(async (req, res) => {
  const data = await facilityService.unblockFacility(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Facility unblocked successfully",
    data,
  });
});

export const resendFacilityInviteHandler = asyncHandler<
  Record<string, never>,
  FacilityIdParams
>(async (req, res) => {
  const result = await facilityService.resendFacilityInvite(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: result.emailSent
      ? "Invite link resent to the facility manager"
      : "Invite could not be sent — check server logs.",
    data: result.facility,
  });
});
