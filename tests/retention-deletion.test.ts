import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  patient: {
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  emailOtp: {
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  loginActivity: {
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  accountSession: {
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("~/lib/db", () => ({
  default: prismaMock,
}));

import {
  anonymizePatientRecord,
  hardDeletePatientRecord,
} from "~/services/retention-service";

describe("permanent PHI deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.patient.update.mockResolvedValue({ id: "patient-1" });
    prismaMock.patient.delete.mockResolvedValue({ id: "patient-1" });
  });

  it("anonymizes PHI fields instead of leaving readable values", async () => {
    await anonymizePatientRecord("patient-1");

    expect(prismaMock.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "patient-1" },
        data: expect.objectContaining({
          firstName: "REDACTED",
          lastName: "REDACTED",
          email: null,
          anonymizedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("hard-deletes patient records after retention clears", async () => {
    await hardDeletePatientRecord("patient-1");

    expect(prismaMock.patient.delete).toHaveBeenCalledWith({
      where: { id: "patient-1" },
    });
  });
});
