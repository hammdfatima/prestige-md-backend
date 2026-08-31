import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import { getAuthUser } from "~/middlewares/auth";
import type { ListSecurityAuditQuery } from "~/schemas/security-audit-schemas";
import { listSecurityAuditEvents } from "~/services/security-audit-service";

export const listSecurityAuditEventsHandler = asyncHandler(async (req, res) => {
  const data = await listSecurityAuditEvents(
    getAuthUser(req),
    req.query as unknown as ListSecurityAuditQuery,
  );

  return res.status(HttpStatus.OK).json({
    message: "Audit events fetched successfully",
    data,
  });
});
