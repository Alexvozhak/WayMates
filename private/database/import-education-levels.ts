import { withDriver } from "@core/neo4j.js";

import educationLevelsData from "./education-levels.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_EDUCATION_LEVELS_QUERY = `
  UNWIND $levels AS level
  MERGE (e:EducationLevel {canonicalName: level.canonicalName})
  SET e.description = level.description,
      e.order = level.order,
      e.verified = true,
      e.createdAt = timestamp(),
      e.createdBy = "system"
`;

type EducationLevelData = { description: string; order: number };
type EducationLevelsJson = Record<string, EducationLevelData>;

const typedData: EducationLevelsJson = educationLevelsData;

async function importEducationLevels(driver: Driver): Promise<void> {
  const levels = Object.entries(typedData).map(([canonicalName, data]) => ({
    canonicalName,
    description: data.description,
    order: data.order,
  }));

  console.log("Starting education levels import...");
  console.log(`Found ${levels.length} education levels to import\n`);

  await driver.executeQuery(IMPORT_EDUCATION_LEVELS_QUERY, { levels });

  console.log("\n✅ Education levels import completed!");
  console.log(`Total imported: ${levels.length} education levels`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importEducationLevels);
}
