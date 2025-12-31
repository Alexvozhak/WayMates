/**
 * Import Demo fixtures (Demo-*.json) into Neo4j test database
 *
 * Usage: set -a && source .env.test && set +a && npx tsx scripts/import-demo-fixtures.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createDriver } from "../src/core/neo4j.js";
import { storyInputSchema } from "../src/shared/schemas.js";
import { importStories } from "../tests/core/helpers/import-stories.js";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "core", "fixtures");

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
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
