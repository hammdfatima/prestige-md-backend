import env from "~/env";
import { assertHttpsUrl } from "~/lib/require-https-url";

const LOCAL_APP_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  const configured = env.APP_URL?.replace(/\/+$/, "");
  if (!configured) {
    return LOCAL_APP_URL;
  }

  assertHttpsUrl(configured, "APP_URL");
  return configured;
}
