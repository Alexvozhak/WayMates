import { createHash } from "node:crypto";

import type { PostgresService } from "./postgres.service.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class UserService {
  constructor(private readonly postgres: PostgresService) {}

  async create(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.postgres.query("INSERT INTO facade.users (user_id, token_hash) VALUES ($1, $2)", [userId, tokenHash]);
  }

  async ensureExists(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.postgres.query(
      "INSERT INTO facade.users (user_id, token_hash) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
      [userId, tokenHash],
    );
  }

  async findByToken(token: string): Promise<{ userId: string } | null> {
    const tokenHash = hashToken(token);
    /* eslint-disable @typescript-eslint/naming-convention -- Database column */
    const result = await this.postgres.query<{ user_id: string }>(
      "SELECT user_id FROM facade.users WHERE token_hash = $1",
      [tokenHash],
    );
    /* eslint-enable @typescript-eslint/naming-convention */
    return result.rows[0] ? { userId: result.rows[0].user_id } : null;
  }

  async updateLastAuthAt(userId: string): Promise<void> {
    await this.postgres.query("UPDATE facade.users SET updated_at = NOW() WHERE user_id = $1", [userId]);
  }

  async delete(userId: string): Promise<void> {
    await this.postgres.query("DELETE FROM facade.users WHERE user_id = $1", [userId]);
  }

  async isColdStartCompleted(userId: string): Promise<boolean> {
    const result = await this.postgres.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM facade.cold_start_completions WHERE user_id = $1) as exists",
      [userId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async markColdStartCompleted(userId: string): Promise<void> {
    await this.postgres.query(
      `INSERT INTO facade.cold_start_completions (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET completed_at = NOW()`,
      [userId],
    );
  }

  async resetColdStartStatus(userId: string): Promise<boolean> {
    const result = await this.postgres.query("DELETE FROM facade.cold_start_completions WHERE user_id = $1", [userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
