/**
 * Setup for story-manager integration tests (WRITE operations)
 *
 * This setup runs ONCE before all story-manager tests in this project.
 * It creates the driver and cleans the database before each test.
 *
 * NOTE: Each test loads its own data (U1-U13) to avoid data race.
 * Tests in this project use singleThread + isolate to ensure sequential execution.
 *
 * IMPORTANT: This project MUST run LAST in test sequence (after read-only tests)
 * because beforeEach cleanup deletes ALL nodes (including U1-U18 from globalSetup).
 * Order is enforced by project name in vitest.config.ts projects array.
 */

import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDriver, withWriteSession } from "../../src/neo4j.js";

import type { Driver } from "neo4j-driver";

export let driver: Driver;

beforeAll(() => {
  console.log("[Story-Manager Setup] Starting shared setup for story-manager tests...");

  driver = createDriver();

  console.log("[Story-Manager Setup] Driver created");
}, 30_000); // 30s timeout for setup

beforeEach(async () => {
  // Clean database before each test (preserve reference data: Language, Skill, SkillCategory, Reason)
  await withWriteSession(driver, async (tx) => {
    await tx.run(`
      MATCH (n)
      WHERE NOT n:Language
        AND NOT n:Skill
        AND NOT n:SkillCategory
        AND NOT n:Reason
      DETACH DELETE n
    `);
  });

  console.log("[Story-Manager Setup] Database cleaned");
}, 30_000); // 30s timeout for database cleanup

afterAll(async () => {
  console.log("[Story-Manager Setup] Cleaning up...");
  await driver.close();
}, 30_000); // 30s timeout for cleanup
