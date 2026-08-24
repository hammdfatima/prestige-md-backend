import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import type {
  CreateVisitBody,
  ListVisitsQuery,
  SendVisitMessageBody,
  UpdateVisitNotesBody,
  VisitIdParams,
} from "~/schemas/visit-schemas";
import * as visitMessageService from "~/services/visit-message-service";
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

export const joinVisitHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.joinVisit(getAuthUser(req), req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Joined visit call successfully",
    data,
  });
});

export const leaveVisitHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.leaveVisit(getAuthUser(req), req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Left visit call successfully",
    data,
  });
});

export const updateVisitNotesHandler = asyncHandler<
  UpdateVisitNotesBody,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.updateVisitNotes(
    getAuthUser(req),
    req.params.id,
    req.body,
  );
  return res.status(HttpStatus.OK).json({
    message: "Visit notes updated successfully",
    data,
  });
});

export const completeVisitHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.completeVisit(
    getAuthUser(req),
    req.params.id,
  );
  return res.status(HttpStatus.OK).json({
    message: "Visit marked as completed",
    data,
  });
});

export const cancelVisitHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitService.cancelVisit(getAuthUser(req), req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Visit cancelled successfully",
    data,
  });
});

export const listVisitMessagesHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitMessageService.listVisitMessages(
    getAuthUser(req),
    req.params.id,
  );
  return res.status(HttpStatus.OK).json({
    message: "Visit messages fetched successfully",
    data,
  });
});

export const getVisitUnreadCountHandler = asyncHandler<
  Record<string, never>,
  VisitIdParams
>(async (req, res) => {
  const data = await visitMessageService.getVisitUnreadCount(
    getAuthUser(req),
    req.params.id,
  );
  return res.status(HttpStatus.OK).json({
    message: "Unread count fetched successfully",
    data,
  });
});

export const sendVisitMessageHandler = asyncHandler<
  SendVisitMessageBody,
  VisitIdParams
>(async (req, res) => {
  const data = await visitMessageService.sendVisitMessage(
    getAuthUser(req),
    req.params.id,
    req.body,
  );
  return res.status(HttpStatus.CREATED).json({
    message: "Message sent",
    data,
  });
});
