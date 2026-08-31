import type { Response } from "express";

import { asyncHandler } from "~/lib/async-handler";
import { auditContextFromRequest } from "~/lib/audit-request-context";
import {
  recordFileAccessed,
  recordFileDeleted,
  recordFileUploaded,
} from "~/lib/phi-access-audit";
import { getAuthUser } from "~/middlewares/auth";
import { HttpError } from "~/middlewares/error-handler";
import type {
  AccessFileInput,
  CompleteUploadInput,
  DeleteFileInput,
  PresignedUploadInput,
} from "~/schemas/files";
import * as filesService from "~/services/files-service";
import type { IAuthRequest } from "~/types";

export const uploadFile = asyncHandler(async (req, res: Response) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const file = req.file;

  if (!file) {
    throw new HttpError("A file is required", 400);
  }

  const data = await filesService.uploadUserFile(user, file);
  recordFileUploaded(user, data.publicId, auditContext);

  return res.status(201).json({
    success: true,
    message: "File uploaded successfully.",
    data,
  });
});

export const createPresignedUpload = asyncHandler(
  async (req: IAuthRequest<PresignedUploadInput>, res: Response) => {
    const user = getAuthUser(req);
    const data = filesService.createUserPresignedUpload(user, req.body);

    return res.status(200).json({
      success: true,
      message: "Presigned upload created.",
      data,
    });
  },
);

export const completeUpload = asyncHandler(
  async (req: IAuthRequest<CompleteUploadInput>, res: Response) => {
    const user = getAuthUser(req);
    const auditContext = auditContextFromRequest(req);
    const data = await filesService.completeUserUpload(user, req.body);
    recordFileUploaded(user, data.publicId, auditContext);

    return res.status(200).json({
      success: true,
      message: "Upload verified successfully.",
      data,
    });
  },
);

export const getFileAccess = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  AccessFileInput
>(async (req, res: Response) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await filesService.getUserFileAccess(user, req.query);
  recordFileAccessed(user, auditContext);

  return res.status(200).json({
    success: true,
    message: "File access granted.",
    data,
  });
});

export const listFiles = asyncHandler(async (req, res: Response) => {
  const user = getAuthUser(req);
  const auditContext = auditContextFromRequest(req);
  const data = await filesService.listUserFiles(user);
  recordFileAccessed(user, auditContext);

  return res.status(200).json({
    success: true,
    message: "Files retrieved successfully.",
    data,
  });
});

export const deleteFile = asyncHandler(
  async (req: IAuthRequest<DeleteFileInput>, res: Response) => {
    const user = getAuthUser(req);
    const auditContext = auditContextFromRequest(req);
    const data = await filesService.deleteUserFile(user, req.body);
    recordFileDeleted(user, req.body.publicId, auditContext);

    return res.status(200).json({
      success: true,
      message: "File deleted successfully.",
      data,
    });
  },
);
