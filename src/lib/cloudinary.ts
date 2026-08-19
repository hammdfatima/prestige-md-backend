import { createHash } from "node:crypto";
import type { UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";

import env from "~/env";
import logger from "~/lib/logger";
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
    return new HttpError("File size exceeds the 10MB limit.", 400);
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
  const toSign = Object.keys(params)
    .filter(
      (key) =>
        params[key] !== undefined &&
        params[key] !== null &&
        params[key] !== "",
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
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

/**
 * Upload via Cloudinary's REST API with an explicit signature.
 * Avoids the Node SDK upload_stream path, which is unreliable under Bun
 * and can cause intermittent "unsigned upload" failures (especially PNGs).
 */
export async function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    resource_type?: CloudinaryResourceType;
    public_id?: string;
    filename?: string;
    mimeType?: string;
  },
): Promise<UploadApiResponse> {
  const credentials = applyCloudinaryConfig();
  const resourceType =
    options.resource_type && options.resource_type !== "auto"
      ? options.resource_type
      : "image";
  const timestamp = Math.round(Date.now() / 1000);

  const signedParams: Record<string, string | number> = {
    folder: options.folder,
    timestamp,
    unique_filename: "true",
    use_filename: "true",
  };

  if (options.public_id) {
    signedParams.public_id = options.public_id;
  }

  const signature = signUploadParams(signedParams, credentials.api_secret);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: options.mimeType || "application/octet-stream",
  });
  form.append("file", blob, options.filename || "upload");
  form.append("api_key", credentials.api_key);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", options.folder);
  form.append("unique_filename", "true");
  form.append("use_filename", "true");
  if (options.public_id) {
    form.append("public_id", options.public_id);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${credentials.cloud_name}/${resourceType}/upload`;

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
      resourceType,
    });
    throw toCloudinaryError({ message, http_code: response.status });
  }

  return payload;
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
  }>;
}
