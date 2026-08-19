import type { Express } from "express";

import {
  type CloudinaryResourceType,
  deleteCloudinaryFile,
  listCloudinaryFiles,
  toUploadedFile,
  uploadBuffer,
} from "~/lib/cloudinary";
import { HttpError } from "~/middlewares/error-handler";
import type { DeleteFileInput } from "~/schemas/files";
import type { TokenPayload } from "~/types";

function userFolder(userId: string) {
  return `prestigemd/${userId}`;
}

function resourceTypeFromMime(mimeType: string): CloudinaryResourceType {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "raw";
}

export async function uploadUserFile(
  user: TokenPayload,
  file: Express.Multer.File,
) {
  if (!file.buffer?.byteLength) {
    throw new HttpError("A file is required", 400);
  }

  const result = await uploadBuffer(file.buffer, {
    folder: userFolder(user.id),
    resource_type: resourceTypeFromMime(file.mimetype),
    filename: file.originalname,
    mimeType: file.mimetype,
  });

  return toUploadedFile(result, file.originalname);
}

export async function listUserFiles(user: TokenPayload) {
  const resources = await listCloudinaryFiles(userFolder(user.id));
  return resources.map((resource) => ({
    publicId: resource.public_id,
    url: resource.url,
    secureUrl: resource.secure_url,
    format: resource.format ?? null,
    resourceType: resource.resource_type,
    bytes: resource.bytes,
    width: resource.width ?? null,
    height: resource.height ?? null,
    originalFilename: resource.original_filename ?? resource.public_id,
  }));
}

export async function deleteUserFile(
  user: TokenPayload,
  input: DeleteFileInput,
) {
  const prefix = `${userFolder(user.id)}/`;
  if (!input.publicId.startsWith(prefix) && input.publicId !== userFolder(user.id)) {
    throw new HttpError("You can only delete your own uploads", 403);
  }

  return deleteCloudinaryFile(
    input.publicId,
    input.resourceType ?? "image",
  );
}
