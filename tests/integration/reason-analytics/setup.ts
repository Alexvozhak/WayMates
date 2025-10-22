/**
 * Shared setup for Reason Analytics integration tests
 *
 * This setup runs ONCE before all reason analytics tests in this project.
 * It loads U8-U9 test data designed for reason transition analytics.
 *
 * Tests in this project use read-only Cypher queries (can run in parallel).
 */

import { beforeAll, afterAll } from 'vitest';
import { createDriver, withWriteSession } from '../../../src/neo4j.js';
import { PersistenceManager } from '../../../src/persistence-manager.js';
import { TestDataManager, type UserKey } from '../../helpers/test-data-manager.js';
import type { Driver } from 'neo4j-driver';

export let driver: Driver;
export let testDataManager: TestDataManager;

beforeAll(async () => {
  console.log('🔧 [Reason Analytics Setup] Starting shared setup...');

  driver = createDriver();
  testDataManager = new TestDataManager();

  // Clean database
  await withWriteSession(driver, async (tx) => {
    await tx.run('MATCH (n) DETACH DELETE n');
  });

  // Load U8-U9 test data (designed for reason analytics scenarios)
  const persistenceManager = new PersistenceManager(driver);
  const userKeys: UserKey[] = ['U8', 'U9'];

  for (const userKey of userKeys) {
    const story = testDataManager.getStoryBy(userKey);
    await persistenceManager.upsertStory(story);
  }

  console.log(`✅ [Reason Analytics Setup] Loaded ${userKeys.length} test users (U8-U9)`);

  // Create NEXT relationships with duration_months
  // U8: Junior → Middle (12mo) → Senior (18mo) → Tech Lead (24mo)
  // U9: Junior → Middle (15mo) → Senior (18mo) → Manager (22mo)
  await withWriteSession(driver, async (tx) => {
    await tx.run(`
      MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
      WITH u, c
      ORDER BY c.created_at ASC
      WITH u, collect(c) AS contexts
      UNWIND range(0, size(contexts) - 2) AS i
      WITH contexts[i] AS c1, contexts[i+1] AS c2
      MERGE (c1)-[r:NEXT]->(c2)
      WITH c1, c2, r, duration.between(datetime(c1.created_at), datetime(c2.created_at)) AS dur
      SET r.duration_months = dur.months + (dur.years * 12)
    `);
  });

  console.log('✅ [Reason Analytics Setup] Created NEXT relationships with duration_months');
}, 60000); // 60s timeout for setup

afterAll(async () => {
  console.log('🧹 [Reason Analytics Setup] Cleaning up...');
  await driver.close();
}, 30000); // 30s timeout for cleanup
