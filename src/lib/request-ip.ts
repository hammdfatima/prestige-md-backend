import type { Request } from "express";

/** Best-effort client IP behind reverse proxies (requires trust proxy). */
export function getRequestIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim();
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim();
  }

  return req.ip || req.socket.remoteAddress || undefined;
}

export function getRequestUserAgent(req: Request): string | undefined {
  const userAgent = req.headers["user-agent"];
  return typeof userAgent === "string" && userAgent.length > 0
    ? userAgent
    : undefined;
}
