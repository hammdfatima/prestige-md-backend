/** HIPAA §8.1 transport security — HSTS, CSP, and related headers. */
import type { HelmetOptions } from "helmet";

/** 1 year — minimum for HSTS preload eligibility. */
export const HSTS_HEADER_VALUE =
  "max-age=31536000; includeSubDomains; preload";

export const BASELINE_SECURITY_HEADERS = {
  "Strict-Transport-Security": HSTS_HEADER_VALUE,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests",
} as const;

export function getHelmetOptions(): HelmetOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    ...(isProduction
      ? {
          hsts: {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: true,
          },
        }
      : {}),
    noSniff: true,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
  };
}
