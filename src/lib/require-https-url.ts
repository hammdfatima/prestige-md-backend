const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isHttpsUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function isLocalHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" && LOCAL_HTTP_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** Reject non-TLS URLs in production (localhost HTTP is allowed in development). */
export function assertHttpsUrl(url: string, label: string) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!isHttpsUrl(url)) {
    throw new Error(`${label} must use HTTPS in production`);
  }
}
