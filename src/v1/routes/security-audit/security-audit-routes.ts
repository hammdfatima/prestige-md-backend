import { Router } from "express";
import { status as HttpStatus } from "http-status";
import { requireAdmin, requirePermission } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import { listSecurityAuditQuerySchema } from "~/schemas/security-audit-schemas";
import { listSecurityAuditEventsHandler } from "~/v1/routes/security-audit/security-audit-handlers";

const SECURITY_AUDIT_ROUTER = Router();

SECURITY_AUDIT_ROUTER.use(requireAdmin);

SECURITY_AUDIT_ROUTER.get(
  "/",
  requirePermission("view_audit_trail"),
  schemaParseMiddleWare(listSecurityAuditQuerySchema, "query"),
  listSecurityAuditEventsHandler,
);

for (const method of ["post", "put", "patch", "delete"] as const) {
  SECURITY_AUDIT_ROUTER[method](
    "/",
    requirePermission("view_audit_trail"),
    (_req, res) => {
      return res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
        message: "Audit trail is read-only",
      });
    },
  );

  SECURITY_AUDIT_ROUTER[method](
    "/:id",
    requirePermission("view_audit_trail"),
    (_req, res) => {
      return res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
        message: "Audit trail is read-only",
      });
    },
  );
}

export default SECURITY_AUDIT_ROUTER;
