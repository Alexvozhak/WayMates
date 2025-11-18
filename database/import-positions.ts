import neo4j, { type Driver } from "neo4j-driver";

import positionsData from "./positions.json" with { type: "json" };

export async function importPositions(driver: Driver): Promise<void> {
  const positions = Object.entries(positionsData);

  console.log("Starting positions import...");
  console.log(`Found ${positions.length} positions to import\n`);

  for (const [, canonicalName] of positions) {
    console.log(`Importing position: ${canonicalName}`);

    await driver.executeQuery(
      `
      MERGE (p:Position {canonicalName: $canonicalName})
      SET p.verified = true,
          p.createdAt = datetime().epochMillis,
          p.createdBy = "system"
    `,
      { canonicalName },
    );
  }

  console.log("\n✅ Positions import completed!");
  console.log(`Total imported: ${positions.length} positions`);
}

async function main(): Promise<void> {
  const env = process.env.ENV || "prod";
  const port = process.env.NEO4J_PORT || "7687";
  const uri = `bolt://localhost:${port}`;
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "password";

  console.log(`Connecting to Neo4j (${env}): ${uri}`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    await driver.verifyConnectivity();
    console.log("✅ Connected to Neo4j");

    await importPositions(driver);
  } catch (error) {
    console.error("❌ Error during import:", error);
    throw error;
  } finally {
    await driver.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
