/**
 * Manual retention job runner (defaults to dry-run unless RETENTION_JOB_LIVE=true).
 *
 * Usage: pnpm retention:run
 */
import { executeRetentionJob } from "../src/jobs/retention-job";

async function main() {
  const report = await executeRetentionJob();
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { default: prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
