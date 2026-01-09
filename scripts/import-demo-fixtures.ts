/**
 * Import Demo fixtures (Demo-*.json) into Neo4j test database
 * Also sets up Goals for waymate fixtures (U5-U8)
 *
 * Usage: set -a && source .env.test && set +a && npx tsx scripts/import-demo-fixtures.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createDriver } from "../src/core/neo4j.js";
import { storyInputSchema } from "../src/shared/schemas.js";
import { importStories } from "../tests/core/helpers/import-stories.js";

import type { Driver } from "neo4j-driver";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "core", "fixtures");

/** Waymate user IDs that need Goals (same goal, haven't reached it yet) */
const WAYMATE_USER_IDS = [
  "usr_019b0055-0005-7000-8000-000000000001", // IdealWaymate
  "usr_019b0055-0006-7000-8000-000000000001", // SprintWaymate
  "usr_019b0055-0007-7000-8000-000000000001", // AltWaymate
  "usr_019b0055-0008-7000-8000-000000000001", // DirectWaymate
];

/** Goal: head of engineering in NL, AI startup */
const WAYMATE_GOAL_TARGET = JSON.stringify({
  position: { mode: "desired", values: ["head of engineering"] },
  role: { mode: "desired", values: ["manager"] },
  countries: { mode: "desired", values: ["NL"] },
  domains: { mode: "desired", values: ["ai"] },
  skills: null,
  languages: null,
  industries: null,
  cities: null,
  citizenships: null,
  educationLevels: null,
});

async function setupWaymateGoals(driver: Driver): Promise<number> {
  const session = driver.session();
  let count = 0;
  try {
    for (const userId of WAYMATE_USER_IDS) {
      const result = await session.run(
        `
        MATCH (u:User {userId: $userId})
        MERGE (u)-[:HAS_GOAL]->(g:Goal)
        SET g.targetContext = $targetContext,
            g.createdAt = datetime(),
            g.updatedAt = datetime()
        RETURN u.userId AS userId
        `,
        { userId, targetContext: WAYMATE_GOAL_TARGET },
      );
      if (result.records.length > 0) count++;
    }
    return count;
  } finally {
    await session.close();
  }
}

async function main(): Promise<void> {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.startsWith("Demo-") && f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No Demo-*.json fixtures found");
    return;
  }

  console.log(`Found ${files.length} demo fixtures: ${files.join(", ")}`);

  const stories = files.map((file) => {
    const content = readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
    const parsed = storyInputSchema.parse(JSON.parse(content));
    return parsed;
  });

  const driver = createDriver();
  try {
    await importStories(driver, stories);
    console.log(`✅ Imported ${stories.length} demo fixtures`);

    const goalsCount = await setupWaymateGoals(driver);
    console.log(`✅ Set goals for ${goalsCount}/${WAYMATE_USER_IDS.length} waymates`);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
