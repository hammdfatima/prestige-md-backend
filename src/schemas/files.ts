import { z } from "zod";

import { OBJECT_STORAGE_MAX_BYTES, OBJECT_STORAGE_MAX_BYTES_LABEL } from "~/lib/object-storage-policy";

export const presignedUploadSchema = z.object({
  contentType: z.string().min(1, "contentType is required"),
  contentLength: z
    .number()
    .int("contentLength must be an integer")
    .positive("contentLength must be positive")
    .max(
      OBJECT_STORAGE_MAX_BYTES,
      `File size exceeds the ${OBJECT_STORAGE_MAX_BYTES_LABEL} limit.`,
    ),
  filename: z.string().min(1, "filename is required").max(255),
});

export const completeUploadSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  contentType: z.string().min(1, "contentType is required"),
  contentLength: presignedUploadSchema.shape.contentLength,
  filename: z.string().min(1).max(255).optional(),
  resourceType: z.enum(["image", "video", "raw", "auto"]).optional(),
});

export const deleteFileSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  resourceType: z.enum(["image", "video", "raw", "auto"]).optional(),
});

export const accessFileSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  resourceType: z.enum(["image", "video", "raw", "auto"]).optional(),
});

export type PresignedUploadInput = z.infer<typeof presignedUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileSchema>;
export type AccessFileInput = z.infer<typeof accessFileSchema>;
