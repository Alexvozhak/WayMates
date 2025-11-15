/**
 * Setup for read-only SearchManager integration tests
 *
 * Loads ALL test data (U1-U18) ONCE before all tests.
 * Tests in this project run in PARALLEL (singleThread: false).
 *
 * Data batches:
 * - Batch A (U1-U9): Adhoc/Target search tests
 * - Batch B (U10-U13): DTW trajectory tests
 * - Batch C (U14-U16): educationLevel tests (AC7-AC9)
 * - Batch D (U17-U18): salary tests (AC10-AC12)
 *
 * Used by:
 * - adhoc-context-without-dtw.integration.ts (AC1-AC12)
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

beforeAll(async () => {
  console.log('[Read-only Setup] Initializing...');

  driver = createDriver();

  // Check if data already loaded (database state check)
  const checkSession = driver.session();
  let userCount = 0;
  try {
    const result = await checkSession.run('MATCH (u:User) RETURN count(u) AS count');
    userCount = Number(result.records[0]?.get('count')) || 0;
    console.log(`[Read-only Setup] Found ${userCount} users in database`);
  } finally {
    await checkSession.close();
  }

  if (userCount !== 18) {
    // Database missing users → clear and reload all test data
    if (userCount > 0) {
      console.log('[Read-only Setup] Clearing incomplete data...');
      const clearSession = driver.session();
      try {
        await clearSession.run('MATCH (n) DETACH DELETE n');
      } finally {
        await clearSession.close();
      }
    }

    const dataManager = new TestDataManager();

    // Load ALL users at once (Batch A + Batch B + Batch C + Batch D)
    const stories = dataManager.getUserStories([
      'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',  // Batch A: Adhoc/Target
      'U10', 'U11', 'U12', 'U13',                             // Batch B: DTW
      'U14', 'U15', 'U16',                                    // Batch C: educationLevel
      'U17', 'U18'                                            // Batch D: salary
    ]);

    await importStories(driver, stories);
    console.log('[Read-only Setup] All test data loaded successfully (U1-U18)');
  } else {
    console.log('[Read-only Setup] Data already loaded (18 users), skipping import');
  }
}, 30000); // 30s timeout

// NO beforeEach cleanup - read-only tests!

afterAll(async () => {
  console.log('[Read-only Setup] Cleaning up...');
  await driver.close();
}, 30000);
