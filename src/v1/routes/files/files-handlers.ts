import type { Response } from "express";

import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import { HttpError } from "~/middlewares/error-handler";
import type { DeleteFileInput } from "~/schemas/files";
import * as filesService from "~/services/files-service";
import type { IAuthRequest } from "~/types";

export const uploadFile = asyncHandler(async (req, res: Response) => {
  const user = getAuthUser(req);
  const file = req.file;

  if (!file) {
    throw new HttpError("A file is required", 400);
  }

  const data = await filesService.uploadUserFile(user, file);

  return res.status(201).json({
    success: true,
    message: "File uploaded successfully.",
    data,
  });
});

export const listFiles = asyncHandler(async (req, res: Response) => {
  const user = getAuthUser(req);
  const data = await filesService.listUserFiles(user);

  return res.status(200).json({
    success: true,
    message: "Files retrieved successfully.",
    data,
  });
});

export const deleteFile = asyncHandler(
  async (req: IAuthRequest<DeleteFileInput>, res: Response) => {
    const user = getAuthUser(req);
    const data = await filesService.deleteUserFile(user, req.body);

    return res.status(200).json({
      success: true,
      message: "File deleted successfully.",
      data,
    });
  },
);
