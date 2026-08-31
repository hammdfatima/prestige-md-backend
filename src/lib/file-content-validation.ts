/** HIPAA §5.1 file upload validation — magic-byte / signature checks. */
import {
  assertUploadContentLength,
  assertUploadMimeType,
  isAllowedUploadMimeType,
  mimeTypesCompatible,
} from "~/lib/object-storage-policy";
import { HttpError } from "~/middlewares/error-handler";

const SIGNATURE_SCAN_BYTES = 8192;

function hasBlockedBinarySignature(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true;
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return true;
  }

  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return true;
  }

  return false;
}

function bufferIncludesDocxMarkers(buffer: Buffer) {
  const sample = buffer
    .subarray(0, Math.min(buffer.length, SIGNATURE_SCAN_BYTES))
    .toString("latin1");

  return (
    sample.includes("word/") || sample.includes("[Content_Types].xml")
  );
}

function isPlainTextBuffer(buffer: Buffer) {
  if (buffer.length === 0 || hasBlockedBinarySignature(buffer)) {
    return false;
  }

  if (buffer.includes(0)) {
    return false;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect MIME type from magic bytes / file signature (not filename or client hint).
 */
export function detectContentMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "application/msword";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    if (bufferIncludesDocxMarkers(buffer)) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return "application/zip";
  }

  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return "application/x-msdownload";
  }

  if (isPlainTextBuffer(buffer)) {
    return "text/plain";
  }

  return null;
}

export function assertBufferMatchesAllowedUpload(
  buffer: Buffer,
  declaredMime: string,
  filename?: string,
) {
  if (!buffer.byteLength) {
    throw new HttpError("A file is required", 400);
  }

  assertUploadContentLength(buffer.byteLength);
  const { mimeType } = assertUploadMimeType(declaredMime, filename);
  const sample = buffer.subarray(0, Math.min(buffer.byteLength, SIGNATURE_SCAN_BYTES));

  if (hasBlockedBinarySignature(sample)) {
    throw new HttpError(
      "File content is not an allowed type (executable content detected)",
      400,
    );
  }

  if (mimeType === "text/plain") {
    if (!isPlainTextBuffer(sample)) {
      throw new HttpError("File content is not valid plain text", 400);
    }
    return { mimeType };
  }

  const detectedMime = detectContentMime(sample);
  if (!detectedMime) {
    throw new HttpError(
      "Unable to verify file content type from file data",
      400,
    );
  }

  if (
    detectedMime === "application/x-msdownload" ||
    detectedMime === "application/zip"
  ) {
    throw new HttpError("File content is not an allowed type", 400);
  }

  if (!mimeTypesCompatible(mimeType, detectedMime)) {
    throw new HttpError(
      "File content does not match the declared type",
      400,
    );
  }

  return { mimeType, detectedMime };
}

export function assertDeclaredUploadType(
  declaredMime: string,
  filename?: string,
) {
  if (!isAllowedUploadMimeType(declaredMime)) {
    throw new HttpError("Unsupported file type", 400);
  }

  return assertUploadMimeType(declaredMime, filename);
}
