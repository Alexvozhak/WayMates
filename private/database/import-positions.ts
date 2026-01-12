import { withDriver } from "@core/neo4j.js";

import positionsData from "./positions.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_POSITIONS_QUERY = `
  UNWIND $positions AS pos
  MERGE (p:Position {canonicalName: pos.canonicalName})
  SET p.description = pos.description,
      p.order = pos.order,
      p.verified = true,
      p.createdAt = timestamp(),
      p.createdBy = "system"
`;

type PositionData = { description: string; order: number };
type PositionsJson = Record<string, PositionData>;

const typedPositionsData: PositionsJson = positionsData;

async function importPositions(driver: Driver): Promise<void> {
  const positions = Object.entries(typedPositionsData).map(([, data]) => ({
    canonicalName: data.description,
    description: data.description,
    order: data.order,
  }));

  console.log("Starting positions import...");
  console.log(`Found ${positions.length} positions to import\n`);

  await driver.executeQuery(IMPORT_POSITIONS_QUERY, { positions });

  console.log("\n✅ Positions import completed!");
  console.log(`Total imported: ${positions.length} positions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importPositions);
}
