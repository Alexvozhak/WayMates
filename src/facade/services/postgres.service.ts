import pg from "pg";

import { PostgresConnectionError } from "../errors.js";
import { logger } from "../logger.js";

import type { QueryResult, QueryResultRow } from "pg";

export class PostgresService {
  static async create(poolConfig: pg.PoolConfig): Promise<PostgresService> {
    const pool = new pg.Pool(poolConfig);

    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected error on idle PostgreSQL client");
    });

    try {
      const client = await pool.connect();
      await client.query("SELECT NOW()");
      client.release();
    } catch (error) {
      throw new PostgresConnectionError(error);
    }

    return new PostgresService(pool);
  }

  private constructor(private readonly pool: pg.Pool) {}

  getPool(): pg.Pool {
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
