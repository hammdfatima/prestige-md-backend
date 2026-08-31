/**
 * Manual admin provisioning — NOT an HTTP endpoint (§16.1).
 *
 * Usage:
 *   ADMIN_PROVISION_ENABLED=true pnpm provision:admin
 *
 * Required env:
 *   ADMIN_PROVISION_EMAIL, ADMIN_PROVISION_PASSWORD,
 *   ADMIN_PROVISION_FIRST_NAME, ADMIN_PROVISION_LAST_NAME
 */
import { UserRole } from "../src/generated/prisma/client";
import prisma from "../src/lib/db";
import { userEmailWhere } from "../src/lib/encryption-queries";
import { storeNewPassword } from "../src/lib/store-new-password";

async function main() {
  if (process.env.ADMIN_PROVISION_ENABLED !== "true") {
    console.error(
      "Refusing to provision admin. Set ADMIN_PROVISION_ENABLED=true for this one-time script.",
    );
    process.exit(1);
  }

  const email = process.env.ADMIN_PROVISION_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PROVISION_PASSWORD;
  const firstName = process.env.ADMIN_PROVISION_FIRST_NAME?.trim();
  const lastName = process.env.ADMIN_PROVISION_LAST_NAME?.trim();
  const phone = process.env.ADMIN_PROVISION_PHONE?.trim();

  if (!email || !password || !firstName || !lastName) {
    console.error(
      "Missing ADMIN_PROVISION_EMAIL, ADMIN_PROVISION_PASSWORD, ADMIN_PROVISION_FIRST_NAME, or ADMIN_PROVISION_LAST_NAME",
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({
    where: userEmailWhere(email),
  });

  if (existing) {
    console.error("An account with this email already exists.");
    process.exit(1);
  }

  const admin = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: await storeNewPassword(password),
      phone: phone || null,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Admin provisioned: ${admin.id} (${admin.email})`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
