/**
 * One-time backfill: encrypt existing plaintext rows and populate lookup hashes.
 *
 * Usage: pnpm exec ts-node -r tsconfig-paths/register scripts/backfill-field-encryption.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import env from "../src/env";
import {
  ENCRYPTED_FIELDS_BY_MODEL,
  LOOKUP_HASH_FIELDS_BY_MODEL,
  type EncryptedPrismaModel,
} from "../src/lib/encrypted-field-config";
import {
  encryptField,
  hashLookupValue,
  isEncryptedValue,
} from "../src/lib/field-encryption";
import { initializeKeyManagement } from "../src/lib/key-management";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function encryptRecord(
  model: EncryptedPrismaModel,
  record: Record<string, unknown>,
) {
  const next = { ...record };
  const fields = ENCRYPTED_FIELDS_BY_MODEL[model];
  const lookupConfig = LOOKUP_HASH_FIELDS_BY_MODEL[model];

  if (lookupConfig) {
    for (const config of lookupConfig) {
      const raw = next[config.sourceField];
      if (typeof raw === "string" && raw.trim() && !isEncryptedValue(raw)) {
        const normalized = config.normalize ? config.normalize(raw) : raw.trim();
        next[config.hashField] = hashLookupValue(normalized);
      }
    }
  }

  for (const field of fields) {
    const value = next[field];
    if (typeof value === "string" && value && !isEncryptedValue(value)) {
      next[field] = encryptField(value);
    }
  }

  return next;
}

async function backfillUsers() {
  const users = await prisma.user.findMany();
  let updated = 0;
  for (const user of users) {
    if (!recordNeedsEncryption("user", user as Record<string, unknown>)) {
      continue;
    }
    const data = encryptRecord("user", user as Record<string, unknown>);
    await prisma.user.update({ where: { id: user.id }, data: data as never });
    updated += 1;
  }
  console.log(
    `Encrypted ${updated} users (${users.length - updated} already encrypted)`,
  );
}

async function backfillFacilities() {
  const facilities = await prisma.facility.findMany();
  let updated = 0;
  for (const facility of facilities) {
    if (!recordNeedsEncryption("facility", facility as Record<string, unknown>)) {
      continue;
    }
    const data = encryptRecord("facility", facility as Record<string, unknown>);
    await prisma.facility.update({
      where: { id: facility.id },
      data: data as never,
    });
    updated += 1;
  }
  console.log(
    `Encrypted ${updated} facilities (${facilities.length - updated} already encrypted)`,
  );
}

function dateToIsoDay(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    // Never slice ciphertext — enc:v1:/enc:v2: values are longer than ISO dates
    // and slicing to 10 chars permanently destroys the payload.
    if (isEncryptedValue(value)) {
      return value;
    }
    return value.slice(0, 10);
  }
  return String(value ?? "");
}

async function backfillPatients() {
  const patients = await prisma.patient.findMany();
  let updated = 0;
  for (const patient of patients) {
    const normalized = {
      ...patient,
      dateOfBirth: dateToIsoDay(patient.dateOfBirth),
      insuranceEffectiveDate: dateToIsoDay(patient.insuranceEffectiveDate),
      examinationDate: dateToIsoDay(patient.examinationDate),
    };
    if (!recordNeedsEncryption("patient", normalized as Record<string, unknown>)) {
      continue;
    }
    const data = encryptRecord("patient", normalized as Record<string, unknown>);
    await prisma.patient.update({
      where: { id: patient.id },
      data: data as never,
    });
    updated += 1;
  }
  console.log(
    `Encrypted ${updated} patients (${patients.length - updated} already encrypted)`,
  );
}

function recordNeedsEncryption(
  model: EncryptedPrismaModel,
  record: Record<string, unknown>,
) {
  const fields = ENCRYPTED_FIELDS_BY_MODEL[model];
  const lookupConfig = LOOKUP_HASH_FIELDS_BY_MODEL[model];

  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value && !isEncryptedValue(value)) {
      return true;
    }
  }

  if (lookupConfig) {
    for (const config of lookupConfig) {
      const raw = record[config.sourceField];
      const hash = record[config.hashField];
      if (typeof raw === "string" && raw.trim() && !hash) {
        return true;
      }
    }
  }

  return false;
}

async function backfillSimple<T extends EncryptedPrismaModel>(
  model: T,
  fetchAll: () => Promise<Array<{ id: string }>>,
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>,
) {
  const rows = await fetchAll();
  let updated = 0;

  for (const row of rows) {
    const full = row as Record<string, unknown>;
    if (!recordNeedsEncryption(model, full)) {
      continue;
    }

    const data = encryptRecord(model, full);
    await update(row.id, data);
    updated += 1;
  }

  console.log(
    `Encrypted ${updated} ${model} rows (${rows.length - updated} already encrypted)`,
  );
}

async function main() {
  await initializeKeyManagement();
  await backfillUsers();
  await backfillFacilities();
  await backfillPatients();

  await backfillSimple("patientMedication", () => prisma.patientMedication.findMany(), (id, data) =>
    prisma.patientMedication.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("visit", () => prisma.visit.findMany(), (id, data) =>
    prisma.visit.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("visitMessage", () => prisma.visitMessage.findMany(), (id, data) =>
    prisma.visitMessage.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("emailOtp", () => prisma.emailOtp.findMany(), (id, data) =>
    prisma.emailOtp.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("loginActivity", () => prisma.loginActivity.findMany(), (id, data) =>
    prisma.loginActivity.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("accountSession", () => prisma.accountSession.findMany(), (id, data) =>
    prisma.accountSession.update({ where: { id }, data: data as never }),
  );
  await backfillSimple("knownLoginDevice", () => prisma.knownLoginDevice.findMany(), (id, data) =>
    prisma.knownLoginDevice.update({ where: { id }, data: data as never }),
  );

  // Append-only by DB trigger — historical rows cannot be updated in place.
  const auditCount = await prisma.securityAuditEvent.count();
  console.log(
    `Skipped ${auditCount} securityAuditEvent rows (append-only table; new events encrypt on insert)`,
  );

  await backfillSimple("notification", () => prisma.notification.findMany(), (id, data) =>
    prisma.notification.update({ where: { id }, data: data as never }),
  );

  console.log("Field encryption backfill complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
