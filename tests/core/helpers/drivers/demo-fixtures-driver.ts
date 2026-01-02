/**
 * Setup for Demo Fixtures integration tests
 *
 * Loads Demo-*.json fixtures ONCE before all tests.
 * Tests in this project are READ-ONLY (no beforeEach reload needed).
 *
 * Data loaded:
 * - 11 demo fixtures (Demo-Alex, Demo-IdealPathfinder, etc.)
 * - 4 waymate goals (for 0005-0008)
 *
 * Used by:
 * - demo-fixtures.integration.ts (DEMO-PF, DEMO-WM, DEMO-RP)
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, afterAll } from "vitest";
import { createDriver } from "../../../../src/core/neo4j.js";
import { DatabaseContext } from "../../../../src/core/database-context.js";
import { GoalsManager } from "../../../../src/core/goals-manager.js";
import { storyInputSchema, targetContextSchema, userIdSchema } from "../../../../src/shared/schemas.js";
import { importStories } from "../import-stories.js";
import { DatabaseFixture } from "../database-fixture.js";
import type { Driver } from "neo4j-driver";
import type { UserId } from "../../../../src/shared/schemas.js";

export let driver: Driver;
export let goalsManager: GoalsManager;
let dbFixture: DatabaseFixture;

const FIXTURES_DIR = path.join(process.cwd(), "tests", "core", "fixtures");

export const ALEX_TARGET_CONTEXT = targetContextSchema.parse({
  position: { mode: "desired", values: ["head of engineering"] },
  role: { mode: "desired", values: ["manager"] },
  countries: { mode: "desired", values: ["NL"] },
  domains: { mode: "desired", values: ["ai"] },
});

// Demo user IDs
export const DEMO_ALEX_USER_ID = userIdSchema.parse("usr_019b0055-0000-7000-8000-000000000001");

export const PATHFINDER_USER_IDS: UserId[] = [
  userIdSchema.parse("usr_019b0055-0001-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0002-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0003-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0004-7000-8000-000000000001"),
];

export const WAYMATE_USER_IDS: UserId[] = [
  userIdSchema.parse("usr_019b0055-0005-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0006-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0007-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0008-7000-8000-000000000001"),
];

export const REVERSE_PATHFINDER_USER_IDS: UserId[] = [
  userIdSchema.parse("usr_019b0055-0009-7000-8000-000000000001"),
  userIdSchema.parse("usr_019b0055-0010-7000-8000-000000000001"),
];

beforeAll(async () => {
  console.log("[Demo Setup] Starting setup for Demo Fixtures tests...");

  driver = createDriver();
  const db = new DatabaseContext(driver);
  dbFixture = new DatabaseFixture(driver);
  goalsManager = new GoalsManager(db);

  // Clean test data (preserves dictionaries)
  await dbFixture.cleanTestData();
  await dbFixture.verifyReferenceData();

  // Load demo fixtures
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.startsWith("Demo-") && f.endsWith(".json"));
  const stories = files.map((file) => {
    const content = readFileSync(path.join(FIXTURES_DIR, file), "utf8");
    return storyInputSchema.parse(JSON.parse(content));
  });

  await importStories(driver, stories);
  console.log(`[Demo Setup] Demo fixtures loaded (${stories.length} users)`);

  // Setup waymate goals via GoalsManager API
  for (const userId of WAYMATE_USER_IDS) {
    await goalsManager.setGoal({
      userId,
      targetContext: ALEX_TARGET_CONTEXT,
    });
  }
  console.log("[Demo Setup] Waymate goals set (4 users)");

  // NOTE: Alex goal is NOT set here — each test manages it via goalsManager.setGoal/deleteGoal

  await dbFixture.verifyUserCount(stories.length);
  console.log("[Demo Setup] Setup complete ✓");
}, 60000);

afterAll(async () => {
  console.log("[Demo Setup] Cleaning up...");
  await driver.close();
}, 30000);
