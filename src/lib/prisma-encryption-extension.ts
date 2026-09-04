import { PrismaClient } from "~/generated/prisma/client";
import {
  ENCRYPTED_FIELDS_BY_MODEL,
  LOOKUP_HASH_FIELDS_BY_MODEL,
  RELATION_MODEL_MAP,
  type EncryptedPrismaModel,
} from "~/lib/encrypted-field-config";
import {
  decryptField,
  encryptField,
  hashLookupValue,
} from "~/lib/field-encryption";

type PlainObject = Record<string, unknown>;

function encryptedFieldsFor(model: string) {
  return ENCRYPTED_FIELDS_BY_MODEL[model as EncryptedPrismaModel];
}

function applyLookupHashes(model: string, data: PlainObject) {
  const lookupConfig = LOOKUP_HASH_FIELDS_BY_MODEL[model as EncryptedPrismaModel];
  if (!lookupConfig) {
    return data;
  }

  const next = { ...data };

  for (const config of lookupConfig) {
    const raw = next[config.sourceField];
    if (typeof raw === "string" && raw.trim()) {
      const normalized = config.normalize ? config.normalize(raw) : raw.trim();
      next[config.hashField] = hashLookupValue(normalized);
      continue;
    }

    if (raw === null) {
      next[config.hashField] = null;
    }
  }

  return next;
}

function encryptData(model: string, data: PlainObject) {
  const fields = encryptedFieldsFor(model);
  if (!fields) {
    return data;
  }

  const withHashes = applyLookupHashes(model, data);
  const next = { ...withHashes };

  for (const field of fields) {
    const value = next[field];
    if (typeof value === "string") {
      next[field] = encryptField(value);
    }
  }

  return next;
}

function decryptData(model: string, data: PlainObject) {
  const fields = encryptedFieldsFor(model);
  if (!fields) {
    return data;
  }

  const next = { ...data };

  for (const field of fields) {
    const value = next[field];
    if (typeof value === "string") {
      next[field] = decryptField(value);
    }
  }

  return next;
}

function encryptWritePayload(model: string, data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  return encryptData(model, data as PlainObject);
}

function transformWhereValue(model: string, where: unknown): unknown {
  if (!where || typeof where !== "object" || Array.isArray(where)) {
    return where;
  }

  const input = where as PlainObject;
  const next: PlainObject = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "AND" && Array.isArray(value)) {
      next.AND = value.map((entry) => transformWhereValue(model, entry));
      continue;
    }

    if (key === "OR" && Array.isArray(value)) {
      next.OR = value.map((entry) => transformWhereValue(model, entry));
      continue;
    }

    if (key === "NOT") {
      next.NOT = transformWhereValue(model, value);
      continue;
    }

    const lookupConfig = LOOKUP_HASH_FIELDS_BY_MODEL[model as EncryptedPrismaModel];
    const emailLookup = lookupConfig?.find((entry) => entry.sourceField === key);

    if (emailLookup && typeof value === "string") {
      const normalized = emailLookup.normalize
        ? emailLookup.normalize(value)
        : value.trim();
      next[emailLookup.hashField] = hashLookupValue(normalized);
      continue;
    }

    if (key === "employeeId" && typeof value === "string" && model === "user") {
      next.employeeIdLookupHash = hashLookupValue(value.trim());
      continue;
    }

    if (key === "actorEmail" && typeof value === "string" && model === "securityAuditEvent") {
      next.actorEmailLookupHash = hashLookupValue(value.trim().toLowerCase());
      continue;
    }

    next[key] = value;
  }

  return next;
}

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function decryptDeep(value: unknown, model?: EncryptedPrismaModel): unknown {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => decryptDeep(entry, model));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const record = value;
  const decrypted = model ? decryptData(model, record) : { ...record };

  for (const [key, nested] of Object.entries(record)) {
    if (nested == null || typeof nested !== "object") {
      continue;
    }

    const nestedModel = RELATION_MODEL_MAP[key];
    if (nestedModel) {
      // Known encrypted relation (e.g. user.facility, visit.patient)
      decrypted[key] = decryptDeep(nested, nestedModel);
      continue;
    }

    // Join-table / intermediate containers (e.g. facilityLinks[]) still
    // contain nested encrypted models further down — keep walking.
    if (Array.isArray(nested) || isPlainObject(nested)) {
      decrypted[key] = decryptDeep(nested, undefined);
    }
  }

  return decrypted;
}

function buildModelQueryHandlers(model: EncryptedPrismaModel) {
  return {
    async $allOperations({
      operation,
      args,
      query,
    }: {
      operation: string;
      args: {
        data?: unknown;
        create?: unknown;
        update?: unknown;
        where?: unknown;
      };
      query: (args: unknown) => Promise<unknown>;
    }) {
      if (args.data) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((entry) => encryptWritePayload(model, entry));
        } else {
          args.data = encryptWritePayload(model, args.data);
        }
      }

      if (args.create) {
        args.create = encryptWritePayload(model, args.create);
      }

      if (args.update) {
        args.update = encryptWritePayload(model, args.update);
      }

      if (args.where) {
        args.where = transformWhereValue(model, args.where);
      }

      const result = await query(args);

      if (
        operation === "createMany" ||
        operation === "updateMany" ||
        operation === "deleteMany" ||
        operation === "count" ||
        operation === "aggregate" ||
        operation === "groupBy"
      ) {
        return result;
      }

      return decryptDeep(result, model);
    },
  };
}

export function createEncryptedPrismaClient(baseClient: PrismaClient) {
  const query = Object.fromEntries(
  (Object.keys(ENCRYPTED_FIELDS_BY_MODEL) as EncryptedPrismaModel[]).map(
    (model) => [model, buildModelQueryHandlers(model)],
  ),
  );

  return baseClient.$extends({
    // Prisma's query-extension types don't model per-model $allOperations well.
    query: query as never,
  });
}

export type EncryptedPrismaClient = ReturnType<typeof createEncryptedPrismaClient>;
