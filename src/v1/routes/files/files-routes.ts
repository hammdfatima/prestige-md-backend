import { Router } from "express";
import type { RequestHandler } from "express";

import { requireAuth } from "~/middlewares/auth";
import { multer_memory_img_doc } from "~/middlewares/multer";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import { deleteFileSchema, completeUploadSchema, presignedUploadSchema, accessFileSchema } from "~/schemas/files";
import * as filesHandlers from "~/v1/routes/files/files-handlers";

const FILES_ROUTER = Router();

FILES_ROUTER.use(requireAuth());

FILES_ROUTER.post(
  "/presigned-upload",
  schemaParseMiddleWare(presignedUploadSchema),
  filesHandlers.createPresignedUpload,
);

FILES_ROUTER.post(
  "/complete-upload",
  schemaParseMiddleWare(completeUploadSchema),
  filesHandlers.completeUpload,
);

FILES_ROUTER.post(
  "/upload",
  multer_memory_img_doc.single("file") as unknown as RequestHandler,
  filesHandlers.uploadFile,
);

FILES_ROUTER.get(
  "/access",
  schemaParseMiddleWare(accessFileSchema, "query"),
  filesHandlers.getFileAccess,
);

FILES_ROUTER.get("/", filesHandlers.listFiles);

FILES_ROUTER.delete(
  "/",
  schemaParseMiddleWare(deleteFileSchema),
  filesHandlers.deleteFile,
);

export default FILES_ROUTER;
