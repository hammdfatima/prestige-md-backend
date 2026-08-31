import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  defaultSchemaPath,
  parsePrismaSchema,
  type PrismaField,
  type PrismaModel,
} from "./lib/parse-prisma-schema";

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

const PHI_TABLES = new Set([
  "patients",
  "patient_medications",
  "visits",
  "visit_messages",
]);

const FK_TARGET_OVERRIDES: Record<string, string> = {
  providerId: "User",
  bookedByUserId: "User",
  senderId: "User",
  createdByUserId: "User",
  deletionRequestedByUserId: "User",
  recipientId: "User|Facility",
};

function repoRoot() {
  return resolve(__dirname, "../..");
}

function mermaidType(field: PrismaField) {
  if (field.isList) {
    return `${field.type}[]`;
  }
  return field.type;
}

function inferFkTarget(fieldName: string, models: PrismaModel[]) {
  if (FK_TARGET_OVERRIDES[fieldName]) {
    return FK_TARGET_OVERRIDES[fieldName];
  }

  if (!fieldName.endsWith("Id")) {
    return null;
  }

  const base =
    fieldName === "id"
      ? null
      : fieldName.slice(0, -2).replace(/User$/, "");

  if (!base) {
    return null;
  }

  const candidates = [
    base.charAt(0).toUpperCase() + base.slice(1),
    base
      .split(/(?=[A-Z])/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(""),
  ];

  for (const candidate of candidates) {
    if (models.some((model) => model.name === candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseRelations(schemaContent: string) {
  const enumNames = new Set<string>();
  for (const match of schemaContent.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
    enumNames.add(match[1]);
  }

  const relations: Array<{
    fromModel: string;
    fromField: string;
    toModel: string;
    cardinality: string;
  }> = [];

  const lines = schemaContent.split(/\r?\n/);
  let currentModel: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      continue;
    }

    if (line === "}") {
      currentModel = null;
      continue;
    }

    if (!currentModel) {
      continue;
    }

    const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
    if (!fieldMatch) {
      continue;
    }

    const [, fieldName, type, listMarker, optionalMarker] = fieldMatch;
    if (SCALAR_TYPES.has(type) || enumNames.has(type)) {
      continue;
    }

    const cardinality = listMarker
      ? "||--o{"
      : optionalMarker
        ? "||--o|"
        : "||--||";

    relations.push({
      fromModel: currentModel,
      fromField: fieldName,
      toModel: type,
      cardinality,
    });
  }

  return relations;
}

function tenancyLabel(model: PrismaModel) {
  const scope =
    model.fields.find((field) => field.name === "facilityId")?.name ??
    model.fields.find((field) => field.name === "patientId")?.name ??
    model.fields.find((field) => field.name === "recipientId")?.name ??
    model.fields.find((field) => field.name === "visitId")?.name ??
    model.fields.find((field) => field.name === "userId")?.name;

  return scope ? `scope: ${scope}` : "platform-wide";
}

function generateDetailErDiagram(
  models: PrismaModel[],
  relations: ReturnType<typeof parseRelations>,
) {
  const lines: string[] = [
    "%% Auto-generated from prisma/schema.prisma — do not edit by hand.",
    "%% Full field-level diagram for https://mermaid.live (erDiagram syntax).",
    "%% Regenerate: pnpm --dir prestige-md-backend compliance:generate-er",
    "erDiagram",
  ];

  for (const model of models) {
    lines.push(`  ${model.name} {`);
    for (const field of model.fields) {
      const typeLabel = mermaidType(field);
      const keySuffix = field.name.endsWith("Id") ? " FK" : "";
      lines.push(`    ${typeLabel} ${field.name}${keySuffix}`);
    }
    lines.push("  }");
  }

  const seen = new Set<string>();
  for (const relation of relations) {
    const key = `${relation.fromModel}-${relation.toModel}-${relation.fromField}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(
      `  ${relation.fromModel} ${relation.cardinality} ${relation.toModel} : "${relation.fromField}"`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function generatePreviewFlowchart(models: PrismaModel[]) {
  const clinical = models.filter((model) => PHI_TABLES.has(model.tableName));
  const org = models.filter((model) =>
    ["facilities", "users", "user_facilities"].includes(model.tableName),
  );
  const auth = models.filter((model) =>
    [
      "email_otps",
      "security_audit_events",
      "known_login_devices",
      "login_activities",
      "account_sessions",
      "in_context_consent_acknowledgments",
    ].includes(model.tableName),
  );
  const other = models.filter(
    (model) =>
      !PHI_TABLES.has(model.tableName) &&
      !org.includes(model) &&
      !auth.includes(model),
  );

  const lines: string[] = [
    "%% Auto-generated from prisma/schema.prisma — do not edit by hand.",
    "%% Preview in VS Code / Cursor (flowchart syntax).",
    "%% Field-level detail: schema-er-diagram-detail.mmd",
    "%% Regenerate: pnpm --dir prestige-md-backend compliance:generate-er",
    "flowchart TB",
    "  classDef phi fill:#fee2e2,stroke:#b91c1c,color:#111",
    "  classDef pii fill:#ffedd5,stroke:#c2410c,color:#111",
    "  classDef auth fill:#e0e7ff,stroke:#4338ca,color:#111",
    "  classDef ops fill:#f3f4f6,stroke:#6b7280,color:#111",
  ];

  function addGroup(title: string, groupModels: PrismaModel[], className: string) {
    if (groupModels.length === 0) {
      return;
    }

    const groupId = title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    lines.push(`  subgraph ${groupId}["${title}"]`);
    lines.push("    direction TB");

    for (const model of groupModels) {
      const nodeId = model.name;
      const phiTag = PHI_TABLES.has(model.tableName) ? " · ePHI" : "";
      lines.push(
        `    ${nodeId}["${model.name}<br/><code>${model.tableName}</code><br/>${tenancyLabel(model)}${phiTag}"]`,
      );
      lines.push(`    class ${nodeId} ${className}`);
    }

    lines.push("  end");
  }

  addGroup("Clinical ePHI", clinical, "phi");
  addGroup("Organization & staff", org, "pii");
  addGroup("Auth & compliance", auth, "auth");
  addGroup("Operational", other, "ops");

  lines.push("");
  lines.push("  %% Foreign-key relationships (scalar FKs only)");

  const seenEdges = new Set<string>();
  for (const model of models) {
    for (const field of model.fields) {
      const target = inferFkTarget(field.name, models);
      if (!target || target.includes("|")) {
        continue;
      }

      const edge = `${model.name} -->|${field.name}| ${target}`;
      const edgeKey = `${model.name}-${field.name}-${target}`;
      if (seenEdges.has(edgeKey)) {
        continue;
      }
      seenEdges.add(edgeKey);
      lines.push(`  ${edge}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const schemaPath = defaultSchemaPath();
  const schemaContent = readFileSync(schemaPath, "utf8");
  const models = parsePrismaSchema(schemaPath);
  const relations = parseRelations(schemaContent);

  const previewPath = resolve(
    repoRoot(),
    "docs/compliance/schema-er-diagram.mmd",
  );
  const detailPath = resolve(
    repoRoot(),
    "docs/compliance/schema-er-diagram-detail.mmd",
  );

  writeFileSync(previewPath, generatePreviewFlowchart(models), "utf8");
  writeFileSync(detailPath, generateDetailErDiagram(models, relations), "utf8");

  console.log(`Generated ${previewPath}`);
  console.log(`Generated ${detailPath}`);
}

main();
