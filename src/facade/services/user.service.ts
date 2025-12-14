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

  async findByTelegramId(telegramUserId: number): Promise<{ userId: string } | null> {
    /* eslint-disable @typescript-eslint/naming-convention -- Database column */
    const result = await this.postgres.query<{ user_id: string }>(
      "SELECT user_id FROM facade.users WHERE telegram_user_id = $1",
      [telegramUserId],
    );
    /* eslint-enable @typescript-eslint/naming-convention */
    if (!result.rows[0]) return null;
    return { userId: result.rows[0].user_id };
  }

  async createTelegramUser(userId: string, token: string, telegramUserId: number): Promise<void> {
    const tokenHash = hashToken(token);
    await this.postgres.query("INSERT INTO facade.users (user_id, token_hash, telegram_user_id) VALUES ($1, $2, $3)", [
      userId,
      tokenHash,
      telegramUserId,
    ]);
  }

  async linkTelegramToUser(userId: string, telegramUserId: number): Promise<void> {
    await this.postgres.query("UPDATE facade.users SET telegram_user_id = $2 WHERE user_id = $1", [
      userId,
      telegramUserId,
    ]);
  }
}
