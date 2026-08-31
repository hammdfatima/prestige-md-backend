import { describe, expect, it } from "vitest";
import { buildPasswordResetLinkEmail } from "~/lib/emails/templates";

describe("password reset email", () => {
  it("contains only a secure link and no standalone token or password values", () => {
    const resetUrl =
      "https://app.prestigemd.com/auth/reset-password?token=signed-jwt-value";
    const email = buildPasswordResetLinkEmail({
      name: "Alex",
      email: "alex@example.com",
      resetUrl,
    });

    expect(email.text).toContain(resetUrl);
    expect(email.html).toContain("Reset password");
    expect(email.text.toLowerCase()).not.toContain("your code");
    expect(email.html).not.toContain("emailCodeBlock");
    expect(email.text).not.toMatch(/\b\d{4,6}\b/);
  });
});
