import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

import { config } from "../env.js";
import { PostgresConnectionError } from "../errors.js";

import type { QueryResult, QueryResultRow } from "pg";

class PostgresService {
  private static instance: PostgresService;

  static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }

  private pool: pg.Pool | null = null;
  private checkpointer: PostgresSaver | null = null;
  private isSetupDone = false;

  private constructor() {
    // Singleton pattern
  }

  async initialize(): Promise<void> {
    if (this.pool) {
      console.log("PostgreSQL connection already initialized");
      return;
    }

    // Create connection pool
    this.pool = new pg.Pool({
      host: config.POSTGRES_HOST,
      port: config.POSTGRES_PORT,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD,
      database: config.POSTGRES_DB,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30_000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      console.log("✅ PostgreSQL connection established");
    } catch (error) {
      throw new PostgresConnectionError(error);
    }

    // Initialize PostgresSaver for checkpointing
    this.checkpointer = new PostgresSaver(this.pool, undefined, {
      schema: "facade", // Use facade schema for checkpoint tables
    });

    // Setup checkpoint tables and cold_start_completions (only needs to be done once)
    if (!this.isSetupDone) {
      try {
        await this.checkpointer.setup();
        await this.setupColdStartTable();
        await this.setupAuthTable();
        this.isSetupDone = true;
        console.log("✅ LangGraph checkpoint tables initialized");
      } catch (error) {
        // Tables might already exist, that's okay
        console.log("ℹ️ Checkpoint tables already exist or setup failed:", error);
      }
    }
  }

  getCheckpointer(): PostgresSaver {
    if (!this.checkpointer) {
      throw new Error("PostgreSQL connection not initialized. Call initialize() first.");
    }
    return this.checkpointer;
  }

  getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error("PostgreSQL connection not initialized. Call initialize() first.");
    }
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const pool = this.getPool();
    return pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.checkpointer = null;
      console.log("PostgreSQL connections closed");
    }
  }

  async setupColdStartTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS facade.cold_start_completions (
        user_id TEXT PRIMARY KEY,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async isColdStartCompleted(userId: string): Promise<boolean> {
    const result = await this.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM facade.cold_start_completions WHERE user_id = $1) as exists",
      [userId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async markColdStartCompleted(userId: string): Promise<void> {
    await this.query(
      `INSERT INTO facade.cold_start_completions (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET completed_at = NOW()`,
      [userId],
    );
  }

  async resetColdStartStatus(userId: string): Promise<boolean> {
    const result = await this.query("DELETE FROM facade.cold_start_completions WHERE user_id = $1", [userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteCheckpoint(threadId: string): Promise<void> {
    const checkpointer = this.getCheckpointer();
    await checkpointer.deleteThread(threadId);
  }

  async getCheckpointState(threadId: string): Promise<Record<string, unknown> | null> {
    const checkpointer = this.getCheckpointer();
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    const tuple = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */

    if (!tuple || !tuple.checkpoint || !tuple.checkpoint.channel_values) {
      return null;
    }

    return tuple.checkpoint.channel_values;
  }

  async hasPendingInterrupt(threadId: string): Promise<boolean> {
    const checkpointer = this.getCheckpointer();
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    const tuple = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */

    if (!tuple || !tuple.pendingWrites) {
      return false;
    }

    // pendingWrites содержит interrupt если есть pending tool calls
    return tuple.pendingWrites.length > 0;
  }

  async setupAuthTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS facade.users (
        user_id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        telegram_user_id BIGINT UNIQUE,
        telegram_username TEXT,
        telegram_first_name TEXT,
        created_via TEXT NOT NULL DEFAULT 'librechat',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_auth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async createUser(userId: string, token: string): Promise<void> {
    await this.query("INSERT INTO facade.users (user_id, token, created_via) VALUES ($1, $2, 'librechat')", [
      userId,
      token,
    ]);
  }

  async findUserByToken(token: string): Promise<{ userId: string } | null> {
    /* eslint-disable @typescript-eslint/naming-convention -- Database column name */
    const result = await this.query<{ user_id: string }>("SELECT user_id FROM facade.users WHERE token = $1", [token]);
    /* eslint-enable @typescript-eslint/naming-convention */
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return { userId: row.user_id };
  }

  async updateLastAuthAt(userId: string): Promise<void> {
    await this.query("UPDATE facade.users SET last_auth_at = NOW() WHERE user_id = $1", [userId]);
  }

  async findUserByTelegramId(telegramUserId: number): Promise<{ userId: string; token: string } | null> {
    /* eslint-disable @typescript-eslint/naming-convention -- Database column name */
    const result = await this.query<{ user_id: string; token: string }>(
      "SELECT user_id, token FROM facade.users WHERE telegram_user_id = $1",
      [telegramUserId],
    );
    /* eslint-enable @typescript-eslint/naming-convention */
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return { userId: row.user_id, token: row.token };
  }

  async createTelegramUser(
    userId: string,
    token: string,
    telegramUserId: number,
    telegramUsername: string | undefined,
    telegramFirstName: string | undefined,
  ): Promise<void> {
    await this.query(
      `INSERT INTO facade.users (user_id, token, telegram_user_id, telegram_username, telegram_first_name, created_via)
       VALUES ($1, $2, $3, $4, $5, 'telegram')`,
      [userId, token, telegramUserId, telegramUsername ?? null, telegramFirstName ?? null],
    );
  }

  async linkTelegramToUser(
    userId: string,
    telegramUserId: number,
    telegramUsername: string | undefined,
    telegramFirstName: string | undefined,
  ): Promise<void> {
    await this.query(
      `UPDATE facade.users
       SET telegram_user_id = $2, telegram_username = $3, telegram_first_name = $4
       WHERE user_id = $1`,
      [userId, telegramUserId, telegramUsername ?? null, telegramFirstName ?? null],
    );
  }
}

export const postgresService = PostgresService.getInstance();
