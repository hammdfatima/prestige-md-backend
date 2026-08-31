import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "~/generated/prisma/client";

const prismaMock = vi.hoisted(() => ({
  patient: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("~/lib/db", () => ({
  default: prismaMock,
}));

import { getPatientForViewer } from "~/services/patient-service";

describe("patient object authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not-found when a nurse requests another facility's patient", async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);

    await expect(
      getPatientForViewer(
        {
          id: "nurse-a",
          role: UserRole.NURSE,
          facilityId: "facility-a",
          sessionId: "session-1",
        },
        "patient-b",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
