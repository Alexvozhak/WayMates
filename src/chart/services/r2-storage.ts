import { randomBytes } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { config } from "../../facade/env.js";
import { ChartGenerationError } from "../types.js";

import type { R2Config } from "../types.js";

/**
 * Validate R2 configuration fields (all or none).
 */
function validateR2Fields(
  accountId: string | undefined,
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined,
  bucketName: string | undefined,
  publicUrl: string | undefined,
): void {
  const fields = [accountId, accessKeyId, secretAccessKey, bucketName, publicUrl];
  const hasAnyField = fields.some(Boolean);
  const hasAllFields = fields.every(Boolean);

  if (hasAnyField && !hasAllFields) {
    throw new ChartGenerationError(
      "R2 configuration is incomplete. Either provide all R2_* env vars or none.",
      "CONFIG_MISSING",
    );
  }

  if (!hasAllFields) {
    throw new ChartGenerationError("R2 is not configured. Chart service is disabled.", "CONFIG_MISSING");
  }
}

/**
 * Get R2 configuration from environment.
 * All R2 fields must be present or none (chart service disabled).
 *
 * @throws {ChartGenerationError} with code 'CONFIG_MISSING' if partial config
 */
export function getR2Config(): R2Config {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_TTL_DAYS } = config;

  validateR2Fields(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL);

  // All fields guaranteed to be present by validateR2Fields check
  return {
    accountId: R2_ACCOUNT_ID!,
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucketName: R2_BUCKET_NAME!,
    publicUrl: R2_PUBLIC_URL!,
    ttlDays: R2_TTL_DAYS,
  };
}

/**
 * R2 storage service for uploading chart HTML files.
 * Uses Cloudflare R2 (S3-compatible API).
 */
export class R2StorageService {
  private static readonly contentType = "text/html; charset=utf-8";

  constructor(private readonly config: R2Config) {}

  /**
   * Upload HTML to R2 and return public URL.
   *
   * @param html - Chart HTML content
   * @returns Public URL and expiration date
   * @throws {ChartGenerationError} with code 'R2_UPLOAD_FAILED'
   */
  async upload(html: string): Promise<{ url: string; expiresAt: string }> {
    const chartId = this.generateChartId();
    const key = `${chartId}.html`;

    try {
      const client = this.createS3Client();

      /* eslint-disable @typescript-eslint/naming-convention */
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName, // AWS SDK требует PascalCase
        Key: key,
        Body: html,
        ContentType: R2StorageService.contentType,
      });
      /* eslint-enable @typescript-eslint/naming-convention */

      await client.send(command);

      const url = `${this.config.publicUrl}/${key}`;
      const expiresAt = this.calculateExpiresAt();

      return { url, expiresAt };
    } catch (error) {
      throw new ChartGenerationError(
        `Failed to upload chart to R2: ${error instanceof Error ? error.message : String(error)}`,
        "R2_UPLOAD_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private generateChartId(): string {
    return randomBytes(16).toString("hex");
  }

  private createS3Client(): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  private calculateExpiresAt(): string {
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + this.config.ttlDays);
    return expiresDate.toISOString();
  }
}
