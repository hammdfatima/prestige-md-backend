import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";

import { logKeyUsage } from "~/lib/key-management/key-usage-audit";
import env from "~/env";

type UnwrapInput = {
  wrappedDekBase64: string;
  region: string;
  expectedKeyId: string;
};

export async function unwrapDataKeyFromKms(input: UnwrapInput) {
  const client = new KMSClient({ region: input.region });

  try {
    const response = await client.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(input.wrappedDekBase64, "base64"),
        KeyId: input.expectedKeyId,
      }),
    );

    if (!response.Plaintext || response.Plaintext.byteLength !== 32) {
      throw new Error("KMS Decrypt did not return a valid 32-byte data key");
    }

    const kmsKeyId = response.KeyId ?? input.expectedKeyId;

    logKeyUsage({
      operation: "KMS_DECRYPT",
      provider: "aws-kms",
      keyVersion: env.DATA_ENCRYPTION_KEY_VERSION,
      keyId: kmsKeyId,
      service: env.SERVICE_NAME,
      success: true,
    });

    return {
      keyMaterial: Buffer.from(response.Plaintext),
      kmsKeyId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "KMS Decrypt failed";

    logKeyUsage({
      operation: "KMS_DECRYPT",
      provider: "aws-kms",
      keyVersion: env.DATA_ENCRYPTION_KEY_VERSION,
      keyId: input.expectedKeyId,
      service: env.SERVICE_NAME,
      success: false,
      errorMessage: message,
    });

    throw error;
  }
}

export async function generateWrappedDataKey() {
  const keyId = env.AWS_KMS_KEY_ID?.trim();
  const region = env.AWS_REGION?.trim();

  if (!keyId || !region) {
    throw new Error("AWS_KMS_KEY_ID and AWS_REGION are required");
  }

  const client = new KMSClient({ region });

  const response = await client.send(
    new GenerateDataKeyCommand({
      KeyId: keyId,
      KeySpec: "AES_256",
    }),
  );

  if (!response.Plaintext || !response.CiphertextBlob) {
    throw new Error("KMS GenerateDataKey returned an incomplete response");
  }

  logKeyUsage({
    operation: "KMS_GENERATE_DATA_KEY",
    provider: "aws-kms",
    keyVersion: env.DATA_ENCRYPTION_KEY_VERSION,
    keyId: response.KeyId ?? keyId,
    service: env.SERVICE_NAME,
    success: true,
  });

  return {
    plaintextKeyBase64: Buffer.from(response.Plaintext).toString("base64"),
    wrappedKeyBase64: Buffer.from(response.CiphertextBlob).toString("base64"),
    kmsKeyId: response.KeyId ?? keyId,
  };
}
