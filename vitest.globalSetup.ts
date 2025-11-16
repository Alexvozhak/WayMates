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
import type { Driver } from 'neo4j-driver';

export async function setup() {
  console.log('[Global Setup] Starting global setup for integration tests...');

  // Load .env.test into process.env
  const env = loadEnv('test', process.cwd(), '');
  Object.assign(process.env, env);

  const driver: Driver = createDriver();

  try {
    // Clear existing data (preserve reference data: Language, Skill, SkillCategory, Reason)
    console.log('[Global Setup] Clearing existing data...');
    const clearSession = driver.session();
    try {
      await clearSession.run(`
        MATCH (n)
        WHERE NOT n:Language
          AND NOT n:Skill
          AND NOT n:SkillCategory
          AND NOT n:Reason
        DETACH DELETE n
      `);

      // Verify reference data preserved
      const refDataResult = await clearSession.run(`
        MATCH (l:Language)
        WITH count(l) AS langCount
        MATCH (s:Skill)
        WITH langCount, count(s) AS skillCount
        MATCH (sc:SkillCategory)
        WITH langCount, skillCount, count(sc) AS categoryCount
        MATCH (r:Reason)
        RETURN langCount, skillCount, categoryCount, count(r) AS reasonCount
      `);

      const record = refDataResult.records[0];
      const langCount = Number(record?.get('langCount')) || 0;
      const skillCount = Number(record?.get('skillCount')) || 0;
      const categoryCount = Number(record?.get('categoryCount')) || 0;
      const reasonCount = Number(record?.get('reasonCount')) || 0;

      console.log(`[Global Setup] Reference data preserved: ${langCount} Languages, ${skillCount} Skills, ${categoryCount} SkillCategories, ${reasonCount} Reasons`);

      if (langCount === 0 || skillCount === 0 || categoryCount === 0 || reasonCount === 0) {
        throw new Error('Reference data missing! Run db:test:init before tests.');
      }

      console.log('[Global Setup] Database cleaned successfully');
    } finally {
      await clearSession.close();
    }

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

    // Verify data loaded correctly
    const verifySession = driver.session();
    try {
      const result = await verifySession.run('MATCH (u:User) RETURN count(u) AS count');
      const userCount = Number(result.records[0]?.get('count')) || 0;
      if (userCount !== 18) {
        throw new Error(`Expected 18 users, found ${userCount}`);
      }
      console.log(`[Global Setup] Verification passed: ${userCount} users loaded`);
    } finally {
      await verifySession.close();
    }
  } finally {
    await driver.close();
  }

  console.log('[Global Setup] Global setup complete ✓');
}

export async function teardown() {
  console.log('[Global Teardown] No teardown needed (DB cleaned in globalSetup)');
}
