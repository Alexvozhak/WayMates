import type { Driver, ManagedTransaction, Session } from "neo4j-driver";
import { session as neo4jSession } from "neo4j-driver";

export class DatabaseContext {
  constructor(private driver: Driver) {}

  async read<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
    const session: Session = this.driver.session({
      defaultAccessMode: neo4jSession.READ,
    });
    try {
      return await session.executeRead(work);
    } finally {
      await session.close();
    }
  }

  async write<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
    const session: Session = this.driver.session({
      defaultAccessMode: neo4jSession.WRITE,
    });
    try {
      return await session.executeWrite(work);
    } finally {
      await session.close();
    }
  }

  getDriver(): Driver {
    return this.driver;
  }
}
