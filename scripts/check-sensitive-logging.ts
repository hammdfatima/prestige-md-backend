import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../src");
const FORBIDDEN_PATTERNS = [
  /logger\.(info|debug)\([^)]*password/i,
  /logger\.(info|debug)\([^)]*\bOTP\b/i,
  /logger\.(info|debug)\([^)]*reset code/i,
  /console\.(log|info|debug)\([^)]*password/i,
];

function walk(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === "generated") continue;
      walk(fullPath, files);
      continue;
    }
    if (fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const violations: string[] = [];

  for (const file of walk(ROOT)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (line.includes("sanitize-for-log") || line.includes("check-sensitive-logging")) {
        continue;
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("Sensitive logging check failed:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log("Sensitive logging check passed.");
}

main();
