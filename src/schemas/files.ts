import { z } from "zod";

export const deleteFileSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  resourceType: z.enum(["image", "video", "raw", "auto"]).optional(),
});

export type DeleteFileInput = z.infer<typeof deleteFileSchema>;
