import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type TraceabilityControl = {
  id: string;
  title: string;
  implementations: string[];
};

type TraceabilityFile = {
  version: number;
  controls: TraceabilityControl[];
  deployedServices: Array<{
    name: string;
    architectureDoc: string;
  }>;
};

function repoRoot() {
  return resolve(__dirname, "../..");
}

function loadTraceability(): TraceabilityFile {
  const path = resolve(
    repoRoot(),
    "docs/compliance/control-traceability.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as TraceabilityFile;
}

function main() {
  const traceability = loadTraceability();
  const errors: string[] = [];

  for (const control of traceability.controls) {
    if (control.implementations.length === 0) {
      errors.push(`Control §${control.id} (${control.title}) has no implementations.`);
      continue;
    }

    for (const implPath of control.implementations) {
      const absolute = resolve(repoRoot(), implPath);
      if (!existsSync(absolute)) {
        errors.push(
          `Control §${control.id} points to missing file: ${implPath}`,
        );
      }
    }
  }

  for (const service of traceability.deployedServices) {
    const docPath = resolve(repoRoot(), service.architectureDoc);
    if (!existsSync(docPath)) {
      errors.push(
        `Deployed service "${service.name}" references missing doc: ${service.architectureDoc}`,
      );
      continue;
    }

    const docContent = readFileSync(docPath, "utf8");
    if (!docContent.includes(service.name)) {
      errors.push(
        `Deployed service "${service.name}" is not mentioned in ${service.architectureDoc}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("Control traceability check failed:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error(
      "\nUpdate docs/compliance/control-traceability.json when moving or deleting control implementations.",
    );
    process.exit(1);
  }

  console.log(
    `Control traceability check passed (${traceability.controls.length} controls, ${traceability.deployedServices.length} deployed services).`,
  );
}

main();
