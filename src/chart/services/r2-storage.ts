import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v7 as uuidv7 } from "uuid";

import { chartConfig } from "../env.js";
import { ChartGenerationError } from "../types.js";

import type { R2Config } from "../types.js";

/**
 * Get R2 configuration from environment.
 * All R2 fields are required — validated by Zod schema in env.ts.
 */
export function getR2Config(): R2Config {
  return {
    accountId: chartConfig.R2_ACCOUNT_ID,
    accessKeyId: chartConfig.R2_ACCESS_KEY_ID,
    secretAccessKey: chartConfig.R2_SECRET_ACCESS_KEY,
    bucketName: chartConfig.R2_BUCKET_NAME,
    publicUrl: chartConfig.R2_PUBLIC_URL,
    ttlDays: chartConfig.R2_TTL_DAYS,
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
    const key = `${uuidv7()}.html`;

    try {
      const client = this.createS3Client();

      /* eslint-disable @typescript-eslint/naming-convention */
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName, // AWS SDK requires PascalCase
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
