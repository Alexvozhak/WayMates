/**
 * Shared Neo4j driver for read-only integration tests
 *
 * This fixture creates a SINGLE driver instance for the entire test suite,
 * following the Shared Fixture Pattern best practice.
 *
 * Used by:
 * - integration-search-read-only project (adhoc, target, current-without-dtw, current-with-dtw)
 *
 * Benefits:
 * - Single connection pool instead of 4 separate pools
 * - Reduced resource consumption
 * - Faster test execution
 * - DRY compliance
 *
 * Data:
 * - Uses U1-U18 from globalSetup (read-only, no modifications)
 */

import { createDriver } from "@core/neo4j.js";
import { afterAll, beforeAll } from "vitest";

import type { Driver } from "neo4j-driver";

export let driver: Driver;

beforeAll(() => {
  console.log("[Shared Driver] Creating shared driver for read-only tests...");
  driver = createDriver();
  console.log("[Shared Driver] Driver created successfully");
});

afterAll(async () => {
  console.log("[Shared Driver] Closing shared driver...");
  await driver.close();
  console.log("[Shared Driver] Driver closed successfully");
});
