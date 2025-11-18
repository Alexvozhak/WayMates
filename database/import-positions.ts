import { withDriver } from "../src/neo4j.js";

import positionsData from "./positions.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_POSITIONS_QUERY = `
  UNWIND $positions AS canonicalName
  MERGE (p:Position {canonicalName: canonicalName})
  SET p.verified = true,
      p.createdAt = timestamp(),
      p.createdBy = "system"
`;

async function importPositions(driver: Driver): Promise<void> {
  const positions = Object.values(positionsData);

  console.log("Starting positions import...");
  console.log(`Found ${positions.length} positions to import\n`);

  await driver.executeQuery(IMPORT_POSITIONS_QUERY, { positions });

  console.log("\n✅ Positions import completed!");
  console.log(`Total imported: ${positions.length} positions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importPositions);
}
