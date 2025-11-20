/**
 * Setup for Goals CRUD integration tests
 *
 * Reimports U1-U18 BEFORE EACH test for isolation.
 * Tests in this project run SEQUENTIALLY (singleThread: true).
 *
 * Goals tests modify the database (create/update/delete Goal nodes AND User nodes),
 * so we need fresh data for each test to avoid side effects.
 *
 * CRITICAL: Must import ALL U1-U18 (not just U1-U13) because this project runs
 * in parallel with read-only tests (both have groupOrder: 0). If we only import
 * U1-U13, read-only tests will fail because they expect U14-U18 to exist.
 *
 * Used by:
 * - goals-integration.integration.ts (G1-G5)
 */

import { beforeAll, beforeEach, afterAll } from "vitest";
import { createDriver } from "../../../../src/core/neo4j.js";
import { UserStories } from "../user-stories.js";
import { importStories } from "../import-stories.js";
import { DatabaseFixture } from "../database-fixture.js";
import type { Driver } from "neo4j-driver";

export let driver: Driver;
let dataManager: UserStories;
let dbFixture: DatabaseFixture;

beforeAll(() => {
  console.log("[Goals Setup] Starting setup for Goals tests...");

  driver = createDriver();
  dataManager = new UserStories();
  dbFixture = new DatabaseFixture(driver);
}, 30000);

beforeEach(async () => {
  // Cleanup Goals + Users before each test (full isolation)
  await dbFixture.cleanNodes("Goal", "User", "Context");

  // Reimport U1-U18 for test isolation (match globalSetup data to avoid breaking read-only tests)
  const stories = dataManager.getUserStories([
    "U1",
    "U2",
    "U3",
    "U4",
    "U5",
    "U6",
    "U7",
    "U8",
    "U9", // Batch A: Adhoc/Target
    "U10",
    "U11",
    "U12",
    "U13", // Batch B: DTW
    "U14",
    "U15",
    "U16", // Batch C: educationLevel
    "U17",
    "U18", // Batch D: salary
  ]);
  await importStories(driver, stories);

  console.log("[Goals Setup] Test data reloaded (U1-U18)");
}, 30000);

afterAll(async () => {
  console.log("[Goals Setup] Cleaning up...");
  await driver.close();
}, 30000);
