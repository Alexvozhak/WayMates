import { createDriver } from "../../src/neo4j.js";
import type { Driver, Session } from "neo4j-driver";
import { expect } from "vitest";

const projectName = process.env.VITEST_PROJECT ?? "";

if (projectName === "integration" || projectName === "functional") {
  const defaultPort = projectName === "functional" ? "7688" : "7689";

  process.env.NEO4J_URI ??= `bolt://localhost:${defaultPort}`;
  process.env.NEO4J_USER ??= "neo4j";
  process.env.NEO4J_PASSWORD ??= "test";
}

export async function setupIntegrationTest(): Promise<{
  driver: Driver;
  session: Session;
}> {
  const driver = await createDriver();
  const session = driver.session();

  await session.executeWrite((tx) => tx.run("MATCH (n) DETACH DELETE n"));

  const verifyResult = await session.executeRead((tx) =>
    tx.run("MATCH (n) RETURN count(n) as total_nodes")
  );
  const nodeCount = Number(verifyResult.records[0]?.get("total_nodes")) ?? 0;
  expect(nodeCount).toBe(0);

  return { driver, session };
}

export async function teardownIntegrationTest(
  session?: Session,
  driver?: Driver
) {
  if (session) await session.close();
  if (driver) await driver.close();
}
