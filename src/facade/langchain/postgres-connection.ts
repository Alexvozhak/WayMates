/**
 * PostgreSQL Connection Singleton for Facade
 * Manages connection pool and checkpointer for LangGraph
 */

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

import { config } from "../env.js";

import type { QueryResult, QueryResultRow } from "pg";

/**
 * Singleton class to manage PostgreSQL connection and checkpointer
 */
class PostgresConnection {
  private static instance: PostgresConnection;

  static getInstance(): PostgresConnection {
    if (!PostgresConnection.instance) {
      PostgresConnection.instance = new PostgresConnection();
    }
    return PostgresConnection.instance;
  }

  private pool: pg.Pool | null = null;
  private checkpointer: PostgresSaver | null = null;
  private isSetupDone = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Initialize connection pool and checkpointer
   * Must be called once at application startup
   */
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
      database: config.POSTGRES_DATABASE,
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
      console.error("❌ PostgreSQL connection failed:", error);
      throw error;
    }

    // Initialize PostgresSaver for checkpointing
    this.checkpointer = new PostgresSaver(this.pool, undefined, {
      schema: "facade", // Use facade schema for checkpoint tables
    });

    // Setup checkpoint tables (only needs to be done once)
    if (!this.isSetupDone) {
      try {
        await this.checkpointer.setup();
        this.isSetupDone = true;
        console.log("✅ LangGraph checkpoint tables initialized");
      } catch (error) {
        // Tables might already exist, that's okay
        console.log("ℹ️ Checkpoint tables already exist or setup failed:", error);
      }
    }
  }

  /**
   * Get the PostgresSaver checkpointer instance
   */
  getCheckpointer(): PostgresSaver {
    if (!this.checkpointer) {
      throw new Error("PostgreSQL connection not initialized. Call initialize() first.");
    }
    return this.checkpointer;
  }

  /**
   * Get the connection pool for direct queries
   */
  getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error("PostgreSQL connection not initialized. Call initialize() first.");
    }
    return this.pool;
  }

  /**
   * Execute a query directly
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    return pool.query<T>(text, params);
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.checkpointer = null;
      console.log("PostgreSQL connections closed");
    }
  }
}

// Export singleton instance
export const postgresConnection = PostgresConnection.getInstance();
