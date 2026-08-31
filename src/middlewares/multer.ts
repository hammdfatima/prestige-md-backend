import multer from "multer";
import path from "node:path";

import {
  ALLOWED_UPLOAD_MIME_TYPES,
  OBJECT_STORAGE_MAX_BYTES,
} from "~/lib/object-storage-policy";
import { HttpError } from "./error-handler";

const destinationPath = path.join(__dirname, "../../data");

type UploadVariant = "image" | "docs" | "both";

const IMAGE_MIME_TYPES = new Set(
  ALLOWED_UPLOAD_MIME_TYPES.filter((mime) => mime.startsWith("image/")),
);

const DOCUMENT_MIME_TYPES = new Set(
  ALLOWED_UPLOAD_MIME_TYPES.filter((mime) => !mime.startsWith("image/")),
);

function allowedMimeTypesForVariant(variant: UploadVariant) {
  if (variant === "image") {
    return IMAGE_MIME_TYPES;
  }
  if (variant === "docs") {
    return DOCUMENT_MIME_TYPES;
  }
  return new Set(ALLOWED_UPLOAD_MIME_TYPES);
}

function fileFilter(variant: UploadVariant): multer.Options["fileFilter"] {
  const allowed = allowedMimeTypesForVariant(variant);

  return (_req, file, cb) => {
    const mimeType = file.mimetype.trim().toLowerCase();

    if (!allowed.has(mimeType)) {
      return cb(
        new HttpError("Invalid file type — only allowed uploads are permitted", 400),
      );
    }

    cb(null, true);
  };
}

function upload(variant: UploadVariant) {
  return multer({
    storage: multer.diskStorage({
      destination(_req, _file, cb) {
        cb(null, destinationPath);
      },
      filename(_req, file, cb) {
        cb(null, `${Date.now()}_${file.originalname}`);
      },
    }),
    fileFilter: fileFilter(variant),
  });
}

function memoryUpload(variant: UploadVariant) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: OBJECT_STORAGE_MAX_BYTES },
    fileFilter: fileFilter(variant),
  });
}

const multer_img = upload("image");
const multer_doc = upload("docs");
const multer_img_doc = upload("both");
const multer_memory_img = memoryUpload("image");
const multer_memory_img_doc = memoryUpload("both");

export {
  multer_doc,
  multer_img_doc,
  multer_img,
  multer_memory_img,
  multer_memory_img_doc,
};
