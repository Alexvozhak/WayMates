import neo4j from "neo4j-driver";

import { config } from "./env.js";

import type { Driver, ManagedTransaction } from "neo4j-driver";

export function createDriver(options?: { uri?: string }): Driver {
  const uri = options?.uri ?? config.NEO4J_URI;
  const { NEO4J_USER: user, NEO4J_PASSWORD: password, NEO4J_MAX_POOL_SIZE: maxPoolSize } = config;

  const driverConfig: neo4j.Config = {
    encrypted: false,
    disableLosslessIntegers: true,
    maxConnectionPoolSize: maxPoolSize,
  };

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), driverConfig);
  return driver;
}

/**
 * Verify that the Neo4j driver can authenticate with the database.
 */
export async function verifyConnection(driver: Driver): Promise<void> {
  await driver.verifyAuthentication();
}

/**
 * Helper to execute read work in a session and close it.
 */
export async function withReadSession<T>(driver: Driver, work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = driver.session();
  try {
    return await session.executeRead((tx) => work(tx));
  } finally {
    await session.close();
  }
}

/**
 * Helper to execute write work in a session and close it.
 */
export async function withWriteSession<T>(driver: Driver, work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = driver.session();
  try {
    return await session.executeWrite((tx) => work(tx));
  } finally {
    await session.close();
  }
}

/**
 * Helper to create driver, execute work, and close driver.
 * Useful for one-off scripts that need driver lifecycle management.
 */
export async function withDriver<T>(fn: (driver: Driver) => Promise<T>): Promise<T> {
  const driver = createDriver();
  try {
    await verifyConnection(driver);
    return await fn(driver);
  } finally {
    await driver.close();
  }
}
