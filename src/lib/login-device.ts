import { createHash, randomBytes } from "node:crypto";

export function getDeviceFingerprint(userAgent: string | undefined): string {
  return createHash("sha256")
    .update(userAgent?.trim() || "unknown-device")
    .digest("hex");
}

export function describeUserAgent(userAgent: string | undefined): string {
  if (!userAgent?.trim()) {
    return "Unknown device";
  }

  const ua = userAgent;
  const browser = ua.includes("Edg/")
    ? "Microsoft Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/")
          ? "Safari"
          : "Web browser";

  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS X") || ua.includes("Macintosh")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : ua.includes("Linux")
            ? "Linux"
            : "Unknown OS";

  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua) ? " (mobile)" : "";

  return `${browser} on ${os}${mobile}`;
}

export function createReportToken(): string {
  return randomBytes(32).toString("hex");
}

export function formatLoginLocation(ipAddress: string | undefined): string {
  if (!ipAddress) {
    return "Unknown location";
  }

  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return "Local network";
  }

  return `Approximate network: ${ipAddress}`;
}
