import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "~/lib/password-reset-token";

describe("password reset token", () => {
  it("creates a verifiable single-use token payload", () => {
    const { token, jti } = createPasswordResetToken({
      accountKind: "user",
      accountId: "user-1",
      email: "User@Example.com",
    });

    const payload = verifyPasswordResetToken(token);
    expect(payload.jti).toBe(jti);
    expect(payload.accountId).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.accountKind).toBe("user");
  });

  it("rejects tampered tokens", () => {
    const { token } = createPasswordResetToken({
      accountKind: "facility",
      accountId: "facility-1",
      email: "manager@example.com",
    });

    expect(() => verifyPasswordResetToken(`${token}x`)).toThrow();
  });
});
