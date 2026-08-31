import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function repoRoot() {
  return resolve(__dirname, "../..");
}

function main() {
  const previewPath = resolve(
    repoRoot(),
    "docs/compliance/schema-er-diagram.mmd",
  );
  const detailPath = resolve(
    repoRoot(),
    "docs/compliance/schema-er-diagram-detail.mmd",
  );
  const beforePreview = readFileSync(previewPath, "utf8");
  const beforeDetail = readFileSync(detailPath, "utf8");

  execSync("ts-node -r tsconfig-paths/register scripts/generate-er-diagram.ts", {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
  });

  const afterPreview = readFileSync(previewPath, "utf8");
  const afterDetail = readFileSync(detailPath, "utf8");
  if (beforePreview !== afterPreview || beforeDetail !== afterDetail) {
    console.error(
      "ER diagrams are out of date. Run: pnpm --dir prestige-md-backend compliance:generate-er",
    );
    process.exit(1);
  }

  execSync(
    "ts-node -r tsconfig-paths/register scripts/check-control-traceability.ts",
    {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    },
  );

  execSync(
    "ts-node -r tsconfig-paths/register scripts/check-phi-data-dictionary.ts",
    {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    },
  );

  console.log("All compliance checks passed.");
}

main();
