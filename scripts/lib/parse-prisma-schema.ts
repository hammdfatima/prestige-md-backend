import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCALAR_TYPES = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "DateTime",
  "Json",
  "Decimal",
  "BigInt",
  "Bytes",
]);

export type PrismaField = {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isRelation: boolean;
};

export type PrismaModel = {
  name: string;
  tableName: string;
  fields: PrismaField[];
};

function stripComments(line: string) {
  return line.replace(/\/\/.*$/, "").trim();
}

function parseField(line: string, enumNames: Set<string>): PrismaField | null {
  const cleaned = stripComments(line);
  if (!cleaned || cleaned.startsWith("@@") || cleaned.startsWith("@")) {
    return null;
  }

  const match = cleaned.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
  if (!match) {
    return null;
  }

  const [, name, type, listMarker, optionalMarker] = match;
  const isList = Boolean(listMarker);
  const isOptional = Boolean(optionalMarker);
  const isRelation =
    !SCALAR_TYPES.has(type) &&
    !enumNames.has(type) &&
    type[0] === type[0]?.toUpperCase();

  return { name, type, isOptional, isList, isRelation };
}

export function parsePrismaSchema(schemaPath: string): PrismaModel[] {
  const content = readFileSync(schemaPath, "utf8");
  const enumNames = new Set<string>();
  for (const match of content.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
    enumNames.add(match[1]);
  }

  const models: PrismaModel[] = [];
  const lines = content.split(/\r?\n/);

  let currentModel: PrismaModel | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = {
        name: modelMatch[1],
        tableName: modelMatch[1],
        fields: [],
      };
      continue;
    }

    if (line === "}" && currentModel) {
      const mapMatch = content
        .slice(content.indexOf(`model ${currentModel.name}`))
        .match(/@@map\("([^"]+)"\)/);
      if (mapMatch) {
        currentModel.tableName = mapMatch[1];
      }
      models.push(currentModel);
      currentModel = null;
      continue;
    }

    if (!currentModel) {
      continue;
    }

    const field = parseField(line, enumNames);
    if (field && !field.isRelation) {
      currentModel.fields.push(field);
    }
  }

  return models;
}

export function defaultSchemaPath() {
  return resolve(__dirname, "../../prisma/schema.prisma");
}
