import { createToken } from "~/lib/jwt";
import type { TokenPayload } from "~/types";

export function issueSessionToken(
  payload: Pick<
    TokenPayload,
    "id" | "role" | "tokenVersion" | "sessionId"
  >,
): string {
  return createToken(
    {
      ...payload,
      lastActiveAt: Date.now(),
    },
    "24h",
  );
}
