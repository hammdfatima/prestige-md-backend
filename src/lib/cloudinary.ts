import type { UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";

import env from "~/env";
import { assertBufferMatchesAllowedUpload } from "~/lib/file-content-validation";
import logger from "~/lib/logger";
import { scanUploadBuffer } from "~/lib/malware-scan";
import {
  OBJECT_STORAGE_MAX_BYTES_LABEL,
  buildBoundUploadParams,
  OBJECT_STORAGE_ENCRYPTION_CONTEXT,
  uploadContextIncludesEncryptionPolicy,
} from "~/lib/object-storage-policy";
import { HttpError } from "~/middlewares/error-handler";

export type CloudinaryResourceType = "image" | "video" | "raw" | "auto";

type CloudinaryCredentials = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

export type UploadedFile = {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string | null;
  resourceType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalFilename: string;
};

export type PresignedCloudinaryUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
  maxFileSize: number;
  resourceType: CloudinaryResourceType;
  uploadUrl: string;
  context: string;
};

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function getCloudinaryCredentials(): CloudinaryCredentials {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(
      "Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      503,
    );
  }

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };
}

function getCloudinaryErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Cloudinary upload failed.";
}

function applyCloudinaryConfig() {
  const credentials = getCloudinaryCredentials();
  cloudinary.config({
    cloud_name: credentials.cloud_name,
    api_key: credentials.api_key,
    api_secret: credentials.api_secret,
    secure: true,
    signature_algorithm: "sha256",
  });
  return credentials;
}

/** Load env + configure SDK. Warns (does not throw) when credentials are missing. */
export function configureCloudinary() {
  if (!isCloudinaryConfigured()) {
    logger.warn(
      "Cloudinary credentials missing; file uploads will return 503 until CLOUDINARY_* env vars are set.",
    );
    return null;
  }

  return applyCloudinaryConfig();
}

function toCloudinaryError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const message = getCloudinaryErrorMessage(error);

  if (
    message.includes(
      "Upload preset must be specified when using unsigned upload",
    )
  ) {
    return new HttpError(
      "Cloudinary rejected the upload as unsigned. Confirm CLOUDINARY_API_SECRET is set and restart the backend.",
      503,
    );
  }

  if (message.includes("Invalid image file")) {
    return new HttpError(
      "The uploaded image file is invalid or corrupted.",
      400,
    );
  }

  if (
    message.toLowerCase().includes("file size") ||
    message.toLowerCase().includes("too large") ||
    message.toLowerCase().includes("max file size")
  ) {
    return new HttpError(
      `File size exceeds the ${OBJECT_STORAGE_MAX_BYTES_LABEL} limit.`,
      400,
    );
  }

  const httpCode =
    error && typeof error === "object" && "http_code" in error
      ? Number((error as { http_code?: unknown }).http_code)
      : undefined;

  return new HttpError(
    message,
    httpCode && httpCode >= 400 && httpCode < 600 ? httpCode : 500,
  );
}

function signUploadParams(
  params: Record<string, string | number>,
  apiSecret: string,
) {
  return cloudinary.utils.api_sign_request(params, apiSecret);
}

function assertEncryptedUploadResponse(payload: UploadApiResponse) {
  if (!payload.secure_url?.startsWith("https://")) {
    throw new HttpError(
      "Uploaded object is not available over HTTPS.",
      500,
    );
  }

  if (!uploadContextIncludesEncryptionPolicy(payload.context)) {
    logger.warn(
      "[cloudinary] upload missing encryption context tag for public_id=%s",
      payload.public_id,
    );
  }
}

export function toUploadedFile(
  result: UploadApiResponse,
  originalFilename?: string,
): UploadedFile {
  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    format: result.format ?? null,
    resourceType: result.resource_type,
    bytes: result.bytes,
    width: result.width ?? null,
    height: result.height ?? null,
    originalFilename:
      originalFilename ||
      result.original_filename ||
      result.public_id.split("/").pop() ||
      "upload",
  };
}

export function createPresignedUpload(options: {
  folder: string;
  mimeType: string;
  contentLength: number;
  filename?: string;
}): PresignedCloudinaryUpload {
  const credentials = applyCloudinaryConfig();
  const { params, resourceType, timestamp, allowedFormats } =
    buildBoundUploadParams(options);
  const signature = signUploadParams(params, credentials.api_secret);
  const context = String(params.context);

  return {
    cloudName: credentials.cloud_name,
    apiKey: credentials.api_key,
    timestamp,
    signature,
    folder: options.folder,
    allowedFormats,
    maxFileSize: options.contentLength,
    resourceType,
    context,
    uploadUrl: `https://api.cloudinary.com/v1_1/${credentials.cloud_name}/${resourceType}/upload`,
  };
}

/**
 * Upload via Cloudinary's REST API with a SHA-256 signature that binds
 * allowed_formats (content type) and max_file_size (content length).
 */
export async function fetchCloudinaryObjectSample(
  secureUrl: string,
  totalBytes: number,
  sampleBytes = 8192,
): Promise<Buffer> {
  const length = Math.min(Math.max(totalBytes, 1), sampleBytes);

  const response = await fetch(secureUrl, {
    headers: { Range: `bytes=0-${length - 1}` },
  });

  if (!response.ok && response.status !== 206) {
    throw new HttpError("Failed to read uploaded object for validation", 502);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    mimeType: string;
    filename?: string;
    resource_type?: CloudinaryResourceType;
  },
): Promise<UploadApiResponse> {
  const credentials = applyCloudinaryConfig();
  const { mimeType } = assertBufferMatchesAllowedUpload(
    buffer,
    options.mimeType,
    options.filename,
  );
  await scanUploadBuffer(buffer, mimeType, options.filename);

  const contentLength = buffer.byteLength;
  const { params, resourceType } = buildBoundUploadParams({
    folder: options.folder,
    mimeType,
    contentLength,
    filename: options.filename,
  });
  const resolvedResourceType =
    options.resource_type && options.resource_type !== "auto"
      ? options.resource_type
      : resourceType;

  const signature = signUploadParams(params, credentials.api_secret);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: options.mimeType || "application/octet-stream",
  });
  form.append("file", blob, options.filename || "upload");
  form.append("api_key", credentials.api_key);
  form.append("timestamp", String(params.timestamp));
  form.append("signature", signature);
  form.append("folder", String(params.folder));
  form.append("allowed_formats", String(params.allowed_formats));
  form.append("max_file_size", String(params.max_file_size));
  form.append("unique_filename", String(params.unique_filename));
  form.append("use_filename", String(params.use_filename));
  form.append("context", String(params.context));

  const endpoint = `https://api.cloudinary.com/v1_1/${credentials.cloud_name}/${resolvedResourceType}/upload`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: form,
    });
  } catch (error) {
    logger.error("[cloudinary] network error:", error);
    throw new HttpError("Failed to reach Cloudinary. Please try again.", 503);
  }

  const payload = (await response.json()) as UploadApiResponse & {
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    const message = payload.error?.message || "Cloudinary upload failed.";
    logger.error("[cloudinary] upload failed:", {
      message,
      status: response.status,
      bytes: buffer.byteLength,
      folder: options.folder,
      resourceType: resolvedResourceType,
    });
    throw toCloudinaryError({ message, http_code: response.status });
  }

  assertEncryptedUploadResponse(payload);
  return payload;
}

export async function getCloudinaryResource(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
) {
  applyCloudinaryConfig();

  return cloudinary.api.resource(publicId, {
    resource_type: resourceType === "auto" ? "image" : resourceType,
  });
}

export async function assertEncryptedStoredObject(
  publicId: string,
  resourceType: CloudinaryResourceType,
  expectedBytes?: number,
) {
  const resource = await getCloudinaryResource(publicId, resourceType);

  if (!resource.secure_url?.startsWith("https://")) {
    throw new HttpError("Stored object is not served over HTTPS.", 500);
  }

  if (
    expectedBytes !== undefined &&
    typeof resource.bytes === "number" &&
    resource.bytes > expectedBytes
  ) {
    throw new HttpError(
      "Stored object exceeds the signed content length.",
      400,
    );
  }

  if (!uploadContextIncludesEncryptionPolicy(resource.context)) {
    throw new HttpError(
      "Stored object is missing the required encryption-at-rest policy tag.",
      500,
    );
  }

  return resource;
}

export async function deleteCloudinaryFile(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
) {
  applyCloudinaryConfig();

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType === "auto" ? "image" : resourceType,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new HttpError("Failed to delete file from Cloudinary.", 500);
  }

  return result;
}

export async function listCloudinaryFiles(prefix: string) {
  applyCloudinaryConfig();

  const result = await cloudinary.api.resources({
    type: "upload",
    prefix,
    max_results: 100,
  });

  return result.resources as Array<{
    public_id: string;
    secure_url: string;
    url: string;
    format: string;
    resource_type: string;
    bytes: number;
    width?: number;
    height?: number;
    created_at: string;
    original_filename?: string;
    context?: unknown;
  }>;
}

export { OBJECT_STORAGE_ENCRYPTION_CONTEXT };
