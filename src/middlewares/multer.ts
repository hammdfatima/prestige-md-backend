import multer from "multer";
import path from "node:path";
import { HttpError } from "./error-handler";

const destinationPath = path.join(__dirname, "../../data");
const imagePattern = /\.(jpeg|jpg|png|svg|webp)$/i;
const docPattern = /\.(pdf|doc|docx)$/i;

type UploadVariant = "image" | "docs" | "both";

function fileFilter(variant: UploadVariant): multer.Options["fileFilter"] {
  return (_req, file, cb) => {
    const name = file.originalname;
    if (variant === "image") {
      if (!name.match(imagePattern)) {
        return cb(
          new HttpError("Invalid file type, only images are allowed", 400),
        );
      }
    } else if (variant === "docs") {
      if (!name.match(docPattern)) {
        return cb(
          new HttpError("Invalid file type, only documents are allowed", 400),
        );
      }
    } else if (!name.match(imagePattern) && !name.match(docPattern)) {
      return cb(
        new HttpError(
          "Invalid file type, only images and documents are allowed",
          400,
        ),
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
    limits: { fileSize: 10 * 1024 * 1024 },
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
