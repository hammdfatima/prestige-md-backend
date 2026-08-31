import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "~/generated/prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  facility: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  accountSession: {
    findFirst: vi.fn(),
  },
}));

const revokeAllAccountSessions = vi.hoisted(() => vi.fn());

vi.mock("~/lib/db", () => ({
  default: prismaMock,
}));

vi.mock("~/services/account-session-service", () => ({
  revokeAllAccountSessions,
  assertAccountSessionActive: vi.fn().mockResolvedValue(undefined),
}));

import { validateSessionToken } from "~/lib/validate-session-token";
import { invalidateUserCredentials } from "~/services/session-revocation-service";

describe("session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({ id: "user-a", role: UserRole.NURSE });
    revokeAllAccountSessions.mockResolvedValue(undefined);
  });

  it("rejects inactive accounts during token validation", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-a",
      role: UserRole.NURSE,
      status: UserStatus.INACTIVE,
      tokenVersion: 1,
      permissions: [],
      facilityId: "facility-1",
      facilityLinks: [],
    });

    await expect(
      validateSessionToken({
        id: "user-a",
        role: UserRole.NURSE,
        tokenVersion: 1,
        sessionId: "session-1",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("invalidates credentials by bumping tokenVersion and revoking sessions", async () => {
    await invalidateUserCredentials("user-a", UserRole.NURSE);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(revokeAllAccountSessions).toHaveBeenCalledWith({
      id: "user-a",
      role: UserRole.NURSE,
    });
  });
});
