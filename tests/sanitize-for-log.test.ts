import { describe, expect, it } from "vitest";
import { sanitizeForLog, sanitizeLogMessage } from "~/lib/sanitize-for-log";

describe("sanitizeForLog", () => {
  it("redacts password fields", () => {
    const input = {
      email: "user@example.com",
      password: "secret123",
      currentPassword: "old",
      nested: { newPassword: "nested-secret" },
    };

    const sanitized = sanitizeForLog(input);
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.currentPassword).toBe("[REDACTED]");
    expect(sanitized.nested.newPassword).toBe("[REDACTED]");
    expect(sanitized.email).toBe("[REDACTED]");
  });

  it("redacts tokens and OTP codes from objects", () => {
    const sanitized = sanitizeForLog({
      token: "jwt-token-value",
      code: "123456",
      stepUpToken: "step-up",
    });

    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.code).toBe("[REDACTED]");
    expect(sanitized.stepUpToken).toBe("[REDACTED]");
  });

  it("redacts sensitive query params from log strings", () => {
    const message = sanitizeLogMessage(
      "GET /auth/reset-password?token=abc123&password=secret",
    );
    expect(message).not.toContain("abc123");
    expect(message).not.toContain("secret");
    expect(message).toContain("[REDACTED]");
  });
});
