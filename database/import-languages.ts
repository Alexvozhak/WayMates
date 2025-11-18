import neo4j, { type Driver } from "neo4j-driver";

import languagesData from "./languages.json" with { type: "json" };

export async function importLanguages(driver: Driver): Promise<void> {
  const languages = Object.entries(languagesData);

  console.log("Starting languages import...");
  console.log(`Found ${languages.length} languages to import\n`);

  for (const [code, name] of languages) {
    console.log(`Importing language: ${code}`);
    console.log(`  Canonical name: ${name}`);

    await driver.executeQuery(
      `
      MERGE (l:Language {code: $code})
      SET l.canonicalName = $name,
          l.verified = true,
          l.createdAt = datetime().epochMillis,
          l.createdBy = "system"
    `,
      { code, name },
    );
  }

  console.log("\n✅ Languages import completed!");
  console.log(`Total imported: ${languages.length} languages`);
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

    await importLanguages(driver);
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
