import type { Express } from "express";
import { status as HttpStatus } from "http-status";

import {
  assertEncryptedStoredObject,
  createPresignedUpload,
  deleteCloudinaryFile,
  fetchCloudinaryObjectSample,
  getCloudinaryResource,
  listCloudinaryFiles,
  toUploadedFile,
  uploadBuffer,
} from "~/lib/cloudinary";
import {
  assertBufferMatchesAllowedUpload,
  assertDeclaredUploadType,
} from "~/lib/file-content-validation";
import {
  assertCallerOwnsObjectKey,
  buildUserObjectPrefix,
} from "~/lib/object-key-ownership";
import { scanStoredUpload } from "~/lib/malware-scan";
import { HttpError } from "~/middlewares/error-handler";
import type {
  AccessFileInput,
  CompleteUploadInput,
  DeleteFileInput,
  PresignedUploadInput,
} from "~/schemas/files";
import type { TokenPayload } from "~/types";

function userFolder(auth: TokenPayload) {
  return buildUserObjectPrefix(auth);
}

export async function uploadUserFile(
  user: TokenPayload,
  file: Express.Multer.File,
) {
  if (!file.buffer?.byteLength) {
    throw new HttpError("A file is required", 400);
  }

  const result = await uploadBuffer(file.buffer, {
    folder: userFolder(user),
    mimeType: file.mimetype,
    filename: file.originalname,
  });

  return toUploadedFile(result, file.originalname);
}

export function createUserPresignedUpload(
  user: TokenPayload,
  input: PresignedUploadInput,
) {
  assertDeclaredUploadType(input.contentType, input.filename);

  return createPresignedUpload({
    folder: userFolder(user),
    mimeType: input.contentType,
    contentLength: input.contentLength,
    filename: input.filename,
  });
}

export async function completeUserUpload(
  user: TokenPayload,
  input: CompleteUploadInput,
) {
  assertCallerOwnsObjectKey(user, input.publicId);
  const { mimeType } = assertDeclaredUploadType(
    input.contentType,
    input.filename,
  );

  const resource = await assertEncryptedStoredObject(
    input.publicId,
    input.resourceType ?? "image",
    input.contentLength,
  );

  const sample = await fetchCloudinaryObjectSample(
    resource.secure_url,
    resource.bytes ?? input.contentLength,
  );

  try {
    assertBufferMatchesAllowedUpload(sample, mimeType, input.filename);
    await scanStoredUpload({
      publicId: resource.public_id,
      secureUrl: resource.secure_url,
      mimeType,
      bytes: resource.bytes ?? input.contentLength,
      filename: input.filename,
    });
  } catch (error) {
    await deleteCloudinaryFile(
      input.publicId,
      input.resourceType ?? "image",
    ).catch(() => undefined);

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError("Uploaded file failed security validation", 400);
  }

  return {
    publicId: resource.public_id,
    url: resource.url,
    secureUrl: resource.secure_url,
    format: resource.format ?? null,
    resourceType: resource.resource_type,
    bytes: resource.bytes,
    width: resource.width ?? null,
    height: resource.height ?? null,
    originalFilename:
      input.filename ||
      resource.original_filename ||
      resource.public_id.split("/").pop() ||
      "upload",
  };
}

export async function getUserFileAccess(
  user: TokenPayload,
  input: AccessFileInput,
) {
  assertCallerOwnsObjectKey(user, input.publicId);

  const resourceType = input.resourceType ?? "image";

  try {
    const resource = await getCloudinaryResource(input.publicId, resourceType);
    return {
      publicId: resource.public_id,
      url: resource.url,
      secureUrl: resource.secure_url,
      format: resource.format ?? null,
      resourceType: resource.resource_type,
      bytes: resource.bytes,
      width: resource.width ?? null,
      height: resource.height ?? null,
      originalFilename:
        resource.original_filename ||
        resource.public_id.split("/").pop() ||
        "upload",
    };
  } catch {
    throw new HttpError("File not found", HttpStatus.NOT_FOUND);
  }
}

export async function listUserFiles(user: TokenPayload) {
  const resources = await listCloudinaryFiles(userFolder(user));
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
  assertCallerOwnsObjectKey(user, input.publicId);

  return deleteCloudinaryFile(
    input.publicId,
    input.resourceType ?? "image",
  );
}
