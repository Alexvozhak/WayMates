/**
 * Global setup for integration tests
 *
 * Loads base test data (U1-U18) ONCE before all test projects run.
 * This prevents race conditions where different projects expect different datasets.
 *
 * Data batches:
 * - Batch A (U1-U9): Adhoc/Target search tests
 * - Batch B (U10-U13): DTW trajectory tests
 * - Batch C (U14-U16): educationLevel tests
 * - Batch D (U17-U18): salary tests
 *
 * Projects using this data:
 * - integration-search-read-only (uses all U1-U18)
 * - integration-search-goals (uses U1-U13, adds Goal nodes)
 * - integration-story-manager (cleans everything, runs last)
 */

import { loadEnv } from 'vite';
import { createDriver } from './src/neo4j.js';
import { TestDataManager } from './tests/helpers/test-data-manager.js';
import { importStories } from './tests/helpers/import-stories.js';
import { DatabaseFixture } from './tests/helpers/database-fixture.js';
import type { Driver } from 'neo4j-driver';

export async function setup() {
  console.log('[Global Setup] Starting global setup for integration tests...');

  // Load .env.test into process.env
  const env = loadEnv('test', process.cwd(), '');
  Object.assign(process.env, env);

  const driver: Driver = createDriver();
  const dbFixture = new DatabaseFixture(driver);

  try {
    // Clear existing data (preserve reference data: Language, Skill, SkillCategory, Reason)
    console.log('[Global Setup] Clearing existing data...');
    await dbFixture.cleanTestData();
    console.log('[Global Setup] Database cleaned successfully');

    // Verify reference data exists
    await dbFixture.verifyReferenceData();

    // Load all base test data (U1-U18)
    const dataManager = new TestDataManager();
    const stories = dataManager.getUserStories([
      'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',  // Batch A: Adhoc/Target
      'U10', 'U11', 'U12', 'U13',                             // Batch B: DTW
      'U14', 'U15', 'U16',                                    // Batch C: educationLevel
      'U17', 'U18'                                            // Batch D: salary
    ]);

    await importStories(driver, stories);
    console.log('[Global Setup] Base data loaded successfully (U1-U18)');

    await dbFixture.verifyUserCount(stories.length);
  } finally {
    await driver.close();
  }

  console.log('[Global Setup] Global setup complete ✓');
}

export async function teardown() {
  console.log('[Global Teardown] No teardown needed (DB cleaned in globalSetup)');
}
