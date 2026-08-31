/**
 * Generate a new KMS-wrapped data encryption key (DEK) for production.
 *
 * Prerequisites:
 * - AWS credentials with kms:GenerateDataKey on your CMK
 * - AWS_KMS_KEY_ID and AWS_REGION set in .env (or environment)
 *
 * Usage: pnpm kms:generate-dek
 *
 * Store the printed AWS_KMS_WRAPPED_DEK in your production secrets manager.
 * Never commit the plaintext DEK — discard it after wrapping.
 */
import { generateWrappedDataKey } from "../src/lib/key-management/providers/aws-kms-provider";

async function main() {
  const result = await generateWrappedDataKey();

  console.log("KMS data key generated successfully.\n");
  console.log(`KMS Key ID: ${result.kmsKeyId}`);
  console.log("\nAdd to production environment:\n");
  console.log(`AWS_KMS_WRAPPED_DEK=${result.wrappedKeyBase64}`);
  console.log("\nOptional — only if migrating from an existing plaintext DEK:");
  console.log(
    "Re-wrap the same key with KMS instead of generating a new one to avoid re-encrypting all rows.",
  );
  console.log(
    "\nPlaintext DEK (discard immediately — do not store in env):",
    result.plaintextKeyBase64,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
