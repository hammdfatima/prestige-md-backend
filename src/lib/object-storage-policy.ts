/** HIPAA §4.3 / §5.1 object storage policy — MIME allowlist, size cap, encryption tags. */
import type { CloudinaryResourceType } from "~/lib/cloudinary";
import { HttpError } from "~/middlewares/error-handler";

/** Authoritative per-file size cap (25 MB). */
export const OBJECT_STORAGE_MAX_BYTES = 25 * 1024 * 1024;

export const OBJECT_STORAGE_MAX_BYTES_LABEL = "25MB";

/**
 * Cloudinary manages AES-256 encryption at rest on underlying object storage.
 * We tag every upload with this context value for inventory/audit checks.
 */
export const OBJECT_STORAGE_ENCRYPTION_CONTEXT =
  "encryption_at_rest=cloudinary_aes256";

export const OBJECT_STORAGE_UPLOAD_POLICY_CONTEXT = "upload_policy=signed_v1";

const MIME_TO_FORMATS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "text/plain": ["txt"],
};

const EXTENSION_TO_FORMAT: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  txt: "txt",
};

/** MIME types allowed for upload — images, PDF, office docs, plain text only. */
export const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze(
  Object.keys(MIME_TO_FORMATS),
) as readonly string[];

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "dll",
  "scr",
  "js",
  "mjs",
  "cjs",
  "sh",
  "bash",
  "ps1",
  "vbs",
  "jar",
  "app",
  "dmg",
  "deb",
  "rpm",
  "php",
  "asp",
  "aspx",
  "jsp",
  "html",
  "htm",
  "svg",
]);

export function resourceTypeFromMime(mimeType: string): CloudinaryResourceType {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  return "raw";
}

export function isAllowedUploadMimeType(mimeType: string) {
  return Boolean(allowedFormatsForMime(mimeType));
}

export function allowedFormatsForMime(mimeType: string) {
  const formats = MIME_TO_FORMATS[mimeType.trim().toLowerCase()];
  if (!formats?.length) {
    return null;
  }
  return formats.join(",");
}

export function allowedFormatsForFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const format = EXTENSION_TO_FORMAT[extension];
  return format ?? null;
}

export function assertUploadContentLength(contentLength: number) {
  if (!Number.isInteger(contentLength) || contentLength <= 0) {
    throw new HttpError("contentLength must be a positive integer", 400);
  }

  if (contentLength > OBJECT_STORAGE_MAX_BYTES) {
    throw new HttpError(
      `File size exceeds the ${OBJECT_STORAGE_MAX_BYTES_LABEL} limit.`,
      400,
    );
  }
}

export function assertUploadMimeType(mimeType: string, filename?: string) {
  const normalized = mimeType.trim().toLowerCase();
  const allowedFormats = allowedFormatsForMime(normalized);

  if (!allowedFormats) {
    throw new HttpError("Unsupported file type", 400);
  }

  if (filename) {
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXTENSIONS.has(extension)) {
      throw new HttpError("Executable and script file types are not allowed", 400);
    }

    const extensionFormat = allowedFormatsForFilename(filename);
    if (
      !extensionFormat ||
      !allowedFormats.split(",").includes(extensionFormat)
    ) {
      throw new HttpError("File extension does not match content type", 400);
    }
  }

  return {
    allowedFormats,
    resourceType: resourceTypeFromMime(normalized),
    mimeType: normalized,
  };
}

export function buildBoundUploadParams(options: {
  folder: string;
  mimeType: string;
  contentLength: number;
  filename?: string;
  timestamp?: number;
}) {
  assertUploadContentLength(options.contentLength);
  const { allowedFormats, resourceType } = assertUploadMimeType(
    options.mimeType,
    options.filename,
  );

  const timestamp = options.timestamp ?? Math.round(Date.now() / 1000);

  return {
    params: {
      folder: options.folder,
      timestamp,
      allowed_formats: allowedFormats,
      max_file_size: options.contentLength,
      unique_filename: "true",
      use_filename: "true",
      context: `${OBJECT_STORAGE_ENCRYPTION_CONTEXT}|${OBJECT_STORAGE_UPLOAD_POLICY_CONTEXT}`,
    } satisfies Record<string, string | number>,
    resourceType,
    timestamp,
    allowedFormats,
  };
}

export function uploadContextIncludesEncryptionPolicy(context?: unknown) {
  if (typeof context !== "object" || context === null) {
    return false;
  }

  const custom = (context as { custom?: unknown }).custom;
  if (typeof custom !== "object" || custom === null) {
    return false;
  }

  const encryption = (custom as Record<string, unknown>).encryption_at_rest;
  return encryption === "cloudinary_aes256";
}

export function mimeTypesCompatible(declaredMime: string, detectedMime: string) {
  if (declaredMime === detectedMime) {
    return true;
  }

  const aliases: Record<string, readonly string[]> = {
    "application/msword": ["application/msword", "application/x-cfb"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ],
  };

  const allowed = aliases[declaredMime];
  return allowed?.includes(detectedMime) ?? false;
}
