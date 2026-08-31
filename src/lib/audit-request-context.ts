import type { Request } from "express";

import { getRequestIp, getRequestUserAgent } from "~/lib/request-ip";
import type { AuditRequestContext } from "~/lib/security-audit";

export function auditContextFromRequest(req: Request): AuditRequestContext {
  return {
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  };
}
