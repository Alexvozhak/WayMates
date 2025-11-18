import { withNeo4jDriver } from "./import-helpers.js";
import reasonsData from "./reasons.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

export async function importReasons(driver: Driver): Promise<void> {
  const reasons = Object.entries(reasonsData);

  console.log("Starting reasons import...");
  console.log(`Found ${reasons.length} reasons to import\n`);

  for (const [reasonId, description] of reasons) {
    console.log(`Importing reason: ${reasonId}`);
    console.log(`  Description: ${description}`);

    await driver.executeQuery(
      `
      MERGE (r:Reason {reasonId: $reasonId})
      SET r.description = $description,
          r.createdAt = timestamp()
    `,
      { reasonId, description },
    );
  }

  console.log("\n✅ Reasons import completed!");
  console.log(`Total imported: ${reasons.length} reasons`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withNeo4jDriver(importReasons);
}
