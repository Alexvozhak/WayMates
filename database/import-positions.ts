import { withNeo4jDriver } from "./import-helpers.js";
import positionsData from "./positions.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

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
          p.createdAt = timestamp(),
          p.createdBy = "system"
    `,
      { canonicalName },
    );
  }

  console.log("\n✅ Positions import completed!");
  console.log(`Total imported: ${positions.length} positions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withNeo4jDriver(importPositions);
}
