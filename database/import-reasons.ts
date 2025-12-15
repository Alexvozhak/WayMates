import { withDriver } from "../src/core/neo4j.js";

import reasonsData from "./reasons.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_REASONS_QUERY = `
  UNWIND $reasons AS reason
  MERGE (r:Reason {canonicalName: reason.canonicalName})
  SET r.description = reason.description,
      r.createdAt = timestamp()
`;

async function importReasons(driver: Driver): Promise<void> {
  const reasons = Object.entries(reasonsData).map(([canonicalName, description]) => ({
    canonicalName,
    description,
  }));

  console.log("Starting reasons import...");
  console.log(`Found ${reasons.length} reasons to import\n`);

  await driver.executeQuery(IMPORT_REASONS_QUERY, { reasons });

  console.log("\n✅ Reasons import completed!");
  console.log(`Total imported: ${reasons.length} reasons`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importReasons);
}
