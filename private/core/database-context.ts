import { session as neo4jSession } from "neo4j-driver";

import { logger } from "./logger.js";

import type { Driver, ManagedTransaction, Session } from "neo4j-driver";

export class DatabaseContext {
  constructor(private driver: Driver) {}

  async read<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
    const session: Session = this.driver.session({
      defaultAccessMode: neo4jSession.READ,
    });
    const start = Date.now();
    try {
      const result = await session.executeRead(work);
      const durationMs = Date.now() - start;
      logger.debug({ durationMs, mode: "read" }, "Neo4j query");
      return result;
    } finally {
      await session.close();
    }
  }

  async write<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
    const session: Session = this.driver.session({
      defaultAccessMode: neo4jSession.WRITE,
    });
    const start = Date.now();
    try {
      const result = await session.executeWrite(work);
      const durationMs = Date.now() - start;
      logger.debug({ durationMs, mode: "write" }, "Neo4j query");
      return result;
    } finally {
      await session.close();
    }
  }

  getDriver(): Driver {
    return this.driver;
  }
}
