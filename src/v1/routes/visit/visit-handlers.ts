import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import type {
  CreateVisitBody,
  ListVisitsQuery,
  VisitIdParams,
} from "~/schemas/visit-schemas";
import * as visitService from "~/services/visit-service";

export const createVisitHandler = asyncHandler<CreateVisitBody>(
  async (req, res) => {
    const data = await visitService.createVisit(getAuthUser(req), req.body);
    return res.status(HttpStatus.CREATED).json({
      message: "Visit booked successfully",
      data,
    });
  },
);

export const listVisitsHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListVisitsQuery
>(async (req, res) => {
  const data = await visitService.listVisits(getAuthUser(req), req.query);
  return res.status(HttpStatus.OK).json({
    message: "Visits fetched successfully",
    data,
  });
});

export const getVisitHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.getVisit(getAuthUser(req), req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Visit fetched successfully",
    data,
  });
});
