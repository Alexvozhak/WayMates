/**
 * Setup for Goals CRUD integration tests
 *
 * Reloads test data (U1, U2, U3) BEFORE EACH test with cleanup.
 * Tests in this project run SEQUENTIALLY (singleThread: true).
 *
 * Goals tests modify the database (create/delete Goal nodes),
 * so we need isolation between tests.
 *
 * Used by:
 * - goals.integration.ts (G1-G5)
 */

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { loadEnv } from 'vite';
import { createDriver, withWriteSession } from '../../../src/neo4j.js';
import { TestDataManager } from '../../helpers/test-data-manager.js';
import { importStories } from '../../helpers/import-stories.js';
import type { Driver } from 'neo4j-driver';

// Load .env.test into process.env
const env = loadEnv('test', process.cwd(), '');
Object.assign(process.env, env);

export let driver: Driver;
let dataManager: TestDataManager;

beforeAll(async () => {
  console.log('[Goals Setup] Starting setup for Goals tests (U1, U2, U3)...');

  driver = createDriver();
  dataManager = new TestDataManager();
}, 30000);

beforeEach(async () => {
  // Cleanup Goals + Users before each test
  await withWriteSession(driver, async (tx) => {
    await tx.run('MATCH (n) WHERE n:Goal OR n:User OR n:Context DETACH DELETE n');
  });

  // Reimport base users for Goals tests
  const stories = dataManager.getUserStories(['U1', 'U2', 'U3']);
  await importStories(driver, stories);

  console.log('[Goals Setup] Test data reloaded (U1, U2, U3)');
}, 30000);

afterAll(async () => {
  console.log('[Goals Setup] Cleaning up...');
  await driver.close();
}, 30000);
