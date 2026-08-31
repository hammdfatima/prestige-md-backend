import { v2 as cloudinary } from "cloudinary";

import env from "~/env";
import {
  configureCloudinary,
  isCloudinaryConfigured,
} from "~/lib/cloudinary";
import logger from "~/lib/logger";
import { OBJECT_STORAGE_MAX_BYTES } from "~/lib/object-storage-policy";

const SIGNED_UPLOAD_PRESET_NAME = "prestige-md-signed";

const PRESET_SETTINGS = {
  unsigned: false,
  max_file_size: OBJECT_STORAGE_MAX_BYTES,
  disallow_public_id: true,
  unique_filename: true,
  use_filename: true,
  overwrite: false,
} as const;

/**
 * Ensures a signed-only upload preset exists so unsigned browser uploads
 * cannot bypass server-side encryption policy tagging.
 */
export async function ensureCloudinaryUploadPolicy() {
  if (!isCloudinaryConfigured()) {
    return;
  }

  configureCloudinary();

  const presetName =
    env.CLOUDINARY_SIGNED_UPLOAD_PRESET?.trim() || SIGNED_UPLOAD_PRESET_NAME;

  try {
    await cloudinary.api.update_upload_preset(presetName, PRESET_SETTINGS);
    logger.info(`Cloudinary upload preset "${presetName}" updated.`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Cloudinary API error";

    if (!message.toLowerCase().includes("not found")) {
      logger.warn(
        `Could not update Cloudinary upload preset "${presetName}": ${message}`,
      );
      return;
    }

    await cloudinary.api.create_upload_preset({
      name: presetName,
      ...PRESET_SETTINGS,
    });
    logger.info(`Cloudinary upload preset "${presetName}" created.`);
  }
}
