/**
 * Setup for Goals CRUD integration tests
 *
 * Reimports U1-U13 BEFORE EACH test for isolation.
 * Tests in this project run SEQUENTIALLY (singleThread: true).
 *
 * Goals tests modify the database (create/update/delete Goal nodes AND User nodes),
 * so we need fresh data for each test to avoid side effects.
 *
 * This runs AFTER read-only tests (which use U1-U18 from globalSetup),
 * so it's safe to clear and reimport U1-U13 here.
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

  // Reimport U1-U13 for test isolation (G5 needs U10 Middle Backend context)
  const stories = dataManager.getUserStories([
    'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',
    'U10', 'U11', 'U12', 'U13'
  ]);
  await importStories(driver, stories);

  console.log('[Goals Setup] Test data reloaded (U1-U13)');
}, 30000);

afterAll(async () => {
  console.log('[Goals Setup] Cleaning up...');
  await driver.close();
}, 30000);
