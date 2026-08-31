import type { NextFunction, Request, Response } from "express";

/**
 * Redirect plain HTTP to HTTPS behind a TLS-terminating reverse proxy.
 * Skipped in development so local http://localhost continues to work.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : req.protocol;

  if (proto === "https") {
    next();
    return;
  }

  const host = req.headers.host;
  if (!host) {
    next();
    return;
  }

  return res.redirect(308, `https://${host}${req.originalUrl}`);
}
