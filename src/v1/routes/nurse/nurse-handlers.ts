import { status as HttpStatus } from "http-status";
import { ZodError } from "zod";
import { asyncHandler } from "~/lib/async-handler";
import {
  createNurseSchema,
  type ListNursesQuery,
  type NurseIdParams,
} from "~/schemas/nurse-schemas";
import * as nurseService from "~/services/nurse-service";

export const createNurseHandler = asyncHandler(async (req, res) => {
  try {
    const body = createNurseSchema.parse(req.body);
    const result = await nurseService.createNurse(body, req.file);
    return res.status(HttpStatus.CREATED).json({
      message: result.emailSent
        ? "Invite link sent to the nurse"
        : "Nurse created. Invite email could not be sent — check server logs.",
      data: result.nurse,
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

export const listNursesHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListNursesQuery
>(async (req, res) => {
  const data = await nurseService.listNurses(req.query);
  return res.status(HttpStatus.OK).json({
    message: "Nurses fetched successfully",
    data,
  });
});

export const blockNurseHandler = asyncHandler<
  Record<string, never>,
  NurseIdParams
>(async (req, res) => {
  const data = await nurseService.blockNurse(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Nurse blocked successfully",
    data,
  });
});

export const unblockNurseHandler = asyncHandler<
  Record<string, never>,
  NurseIdParams
>(async (req, res) => {
  const data = await nurseService.unblockNurse(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Nurse unblocked successfully",
    data,
  });
});
