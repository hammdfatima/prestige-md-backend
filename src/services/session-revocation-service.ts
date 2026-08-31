import { UserRole } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { revokeAllAccountSessions } from "~/services/account-session-service";

export async function invalidateUserCredentials(userId: string, role: UserRole) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  await revokeAllAccountSessions({ id: userId, role });
}

export async function invalidateFacilityCredentials(facilityId: string) {
  await prisma.facility.update({
    where: { id: facilityId },
    data: { tokenVersion: { increment: 1 } },
  });
  await revokeAllAccountSessions({
    id: facilityId,
    role: UserRole.FACILITY_MANAGER,
  });
}
