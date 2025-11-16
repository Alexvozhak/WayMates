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

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { createDriver, withWriteSession } from '../../../src/neo4j.js';
import { TestDataManager } from '../../helpers/test-data-manager.js';
import { importStories } from '../../helpers/import-stories.js';
import type { Driver } from 'neo4j-driver';

export let driver: Driver;
let dataManager: TestDataManager;

beforeAll(async () => {
  console.log('[Goals Setup] Starting setup for Goals tests...');

  driver = createDriver();
  dataManager = new TestDataManager();
}, 30000);

beforeEach(async () => {
  // Cleanup Goals + Users before each test (full isolation)
  await withWriteSession(driver, async (tx) => {
    await tx.run('MATCH (n) WHERE n:Goal OR n:User OR n:Context DETACH DELETE n');
  });

  // Reimport U1-U18 for test isolation (match globalSetup data to avoid breaking read-only tests)
  const stories = dataManager.getUserStories([
    'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',   // Batch A: Adhoc/Target
    'U10', 'U11', 'U12', 'U13',                             // Batch B: DTW
    'U14', 'U15', 'U16',                                    // Batch C: educationLevel
    'U17', 'U18'                                            // Batch D: salary
  ]);
  await importStories(driver, stories);

  console.log('[Goals Setup] Test data reloaded (U1-U18)');
}, 30000);

afterAll(async () => {
  console.log('[Goals Setup] Cleaning up...');
  await driver.close();
}, 30000);
