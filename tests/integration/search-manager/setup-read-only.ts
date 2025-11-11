/**
 * Setup for read-only SearchManager integration tests
 *
 * Loads ALL test data (U1-U13) ONCE before all tests.
 * Tests in this project run in PARALLEL (singleThread: false).
 *
 * Data batches:
 * - Batch A (U1-U9): Adhoc/Target search tests
 * - Batch B (U10-U13): DTW trajectory tests
 *
 * Used by:
 * - adhoc-context-without-dtw.integration.ts (AC1-AC6)
 * - target-context.integration.ts (TG1-TG7)
 * - current-context-without-dtw.integration.ts (UN1, UN4)
 * - current-context-with-dtw.integration.ts (DT1-DT5)
 */

import { beforeAll, afterAll } from 'vitest';
import { loadEnv } from 'vite';
import { createDriver } from '../../../src/neo4j.js';
import { TestDataManager } from '../../helpers/test-data-manager.js';
import { importStories } from '../../helpers/import-stories.js';
import type { Driver } from 'neo4j-driver';

// Load .env.test into process.env
const env = loadEnv('test', process.cwd(), '');
Object.assign(process.env, env);

export let driver: Driver;
let isDataLoaded = false;

beforeAll(async () => {
  console.log('[Read-only Setup] Loading ALL test data (U1-U13)...');

  driver = createDriver();

  if (!isDataLoaded) {
    const dataManager = new TestDataManager();

    // Load ALL users at once (Batch A + Batch B)
    const stories = dataManager.getUserStories([
      'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',  // Batch A: Adhoc/Target
      'U10', 'U11', 'U12', 'U13'                              // Batch B: DTW
    ]);

    await importStories(driver, stories);
    isDataLoaded = true;
    console.log('[Read-only Setup] All test data loaded successfully (U1-U13)');
  }
}, 30000); // 30s timeout

// NO beforeEach cleanup - read-only tests!

afterAll(async () => {
  console.log('[Read-only Setup] Cleaning up...');
  await driver.close();
}, 30000);
