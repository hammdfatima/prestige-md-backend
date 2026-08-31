import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  defaultSchemaPath,
  parsePrismaSchema,
  type PrismaModel,
} from "./lib/parse-prisma-schema";

type FieldClassification =
  | "phi"
  | "pii"
  | "sensitive"
  | "operational"
  | "none";

type DictionaryField = {
  type: string;
  classification: FieldClassification;
  encryptedAtRest: boolean;
  consumers: string[];
  notes?: string;
};

type DictionaryTable = {
  model: string;
  phiTable: boolean;
  retention: string;
  tenancy: {
    scopeColumn: string | null;
    ownerColumns: string[];
  };
  services: string[];
  fields: Record<string, DictionaryField>;
};

type PhiDataDictionary = {
  version: number;
  tables: Record<string, DictionaryTable>;
};

function repoRoot() {
  return resolve(__dirname, "../..");
}

function loadDictionary(): PhiDataDictionary {
  const dictionaryPath = resolve(
    repoRoot(),
    "docs/compliance/phi-data-dictionary.json",
  );
  return JSON.parse(readFileSync(dictionaryPath, "utf8")) as PhiDataDictionary;
}

function modelTableName(model: PrismaModel) {
  return model.tableName;
}

function findDictionaryTable(
  dictionary: PhiDataDictionary,
  model: PrismaModel,
): DictionaryTable | undefined {
  return (
    dictionary.tables[model.tableName] ??
    dictionary.tables[model.name] ??
    Object.values(dictionary.tables).find((table) => table.model === model.name)
  );
}

function main() {
  const models = parsePrismaSchema(defaultSchemaPath());
  const dictionary = loadDictionary();
  const errors: string[] = [];

  for (const model of models) {
    const tableKey = modelTableName(model);
    const tableEntry = findDictionaryTable(dictionary, model);

    if (!tableEntry) {
      errors.push(
        `Missing dictionary entry for model ${model.name} (table: ${tableKey}). Add it to docs/compliance/phi-data-dictionary.json.`,
      );
      continue;
    }

    if (tableEntry.model !== model.name) {
      errors.push(
        `Dictionary model mismatch for table ${tableKey}: expected ${model.name}, found ${tableEntry.model}.`,
      );
    }

    const schemaFields = new Set(model.fields.map((field) => field.name));
    const dictionaryFields = new Set(Object.keys(tableEntry.fields));

    for (const field of model.fields) {
      if (!dictionaryFields.has(field.name)) {
        const severity = tableEntry.phiTable ? "PHI table" : "table";
        errors.push(
          `${severity} ${tableKey}.${field.name} exists in Prisma schema but is missing from the data dictionary.`,
        );
      }
    }

    for (const fieldName of dictionaryFields) {
      if (!schemaFields.has(fieldName)) {
        errors.push(
          `Stale dictionary field ${tableKey}.${fieldName} — no longer in Prisma schema.`,
        );
      }
    }

    if (tableEntry.phiTable) {
      for (const [fieldName, fieldEntry] of Object.entries(tableEntry.fields)) {
        if (
          fieldEntry.classification === "none" &&
          !fieldEntry.notes?.trim()
        ) {
          errors.push(
            `PHI table ${tableKey}.${fieldName} is marked non-PHI (classification: none) but has no notes explaining why.`,
          );
        }
      }
    }
  }

  for (const tableName of Object.keys(dictionary.tables)) {
    const exists = models.some(
      (model) =>
        model.tableName === tableName ||
        model.name === tableName ||
        dictionary.tables[tableName]?.model === model.name,
    );
    if (!exists) {
      errors.push(
        `Stale dictionary table entry "${tableName}" — no matching Prisma model.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("PHI data dictionary check failed:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error(
      "\nUpdate docs/compliance/phi-data-dictionary.json whenever prisma/schema.prisma changes.",
    );
    process.exit(1);
  }

  console.log(
    `PHI data dictionary check passed (${models.length} models, ${Object.keys(dictionary.tables).length} dictionary tables).`,
  );
}

main();
