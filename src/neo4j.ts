import neo4j from "neo4j-driver";

import type { Driver, ManagedTransaction } from "neo4j-driver";

type Credentials = {
  uri: string;
  user: string;
  password: string;
};

export function createDriver(): Driver {
  const { uri, user, password } = getCredentials();

  const config: neo4j.Config = {
    encrypted: false,
    disableLosslessIntegers: true,
  };

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), config);
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
export async function withReadSession<T>(
  driver: Driver,
  work: (tx: ManagedTransaction) => Promise<T>,
): Promise<T> {
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
export async function withWriteSession<T>(
  driver: Driver,
  work: (tx: ManagedTransaction) => Promise<T>,
): Promise<T> {
  const session = driver.session();
  try {
    return await session.executeWrite((tx) => work(tx));
  } finally {
    await session.close();
  }
}

function getCredentials(): Credentials {
  const requiredEnvVars = ["NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"];

  const missing = requiredEnvVars.filter((env) => !process.env[env]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  };
}
