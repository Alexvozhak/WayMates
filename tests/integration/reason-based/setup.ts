/**
 * Shared setup for reason-based integration tests
 *
 * This setup runs ONCE before all reason-based tests in this project.
 * It creates the driver and imports Reason nodes.
 *
 * NOTE: Unlike GDS tests, reason-based tests create users dynamically in each test.
 * This is because they test different duration scenarios with programmatically created data.
 *
 * Tests in this project use singleThread to share driver state.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { createDriver, withWriteSession } from '../../../src/neo4j.js';
import type { Driver } from 'neo4j-driver';

export let driver: Driver;

beforeAll(async () => {
  console.log('🔧 [Reason Setup] Starting shared setup for reason-based tests...');

  driver = createDriver();

  console.log('✅ [Reason Setup] Driver created');
}, 30000); // 30s timeout for setup

beforeEach(async () => {
  // Clean database before each test
  await withWriteSession(driver, async (tx) => {
    await tx.run('MATCH (n) DETACH DELETE n');
  });

  // Re-import Reason nodes (needed for [:CHANGED_FOR] relationships)
  await withWriteSession(driver, async (tx) => {
    await tx.run(`
      CREATE (r1:Reason {
        reason_id: 'position_changed',
        description: 'Position or role changed within career',
        patterns: ['promoted to', 'changed role to'],
        common_combinations: [],
        examples: ['Promoted from Junior to Mid Developer']
      })
      CREATE (r2:Reason {
        reason_id: 'location_changed',
        description: 'Relocated to different city or country',
        patterns: ['moved to', 'relocated to'],
        common_combinations: [],
        examples: ['Moved from Moscow to Berlin']
      })
      CREATE (r3:Reason {
        reason_id: 'skill_learning',
        description: 'Learned new technical skills or framework',
        patterns: ['learned', 'mastered'],
        common_combinations: [],
        examples: ['Learned React and TypeScript']
      })
    `);
  });

  console.log('🧹 [Reason Setup] Database cleaned, Reason nodes created');
});

afterAll(async () => {
  console.log('🧹 [Reason Setup] Cleaning up...');
  await driver.close();
}, 30000); // 30s timeout for cleanup
