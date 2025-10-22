/**
 * Shared setup for GDS integration tests
 *
 * This setup runs ONCE before all GDS tests in this project.
 * It loads U1-U7 test data that all GDS tests share.
 *
 * Tests in this project use singleThread to share this state.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { createDriver, withWriteSession } from '../../../src/neo4j.js';
import { PersistenceManager } from '../../../src/persistence-manager.js';
import { TestDataManager } from '../../helpers/test-data-manager.js';
import { GdsProjectionService } from '../../../src/gds/services/gds-projection.service.js';
import type { Driver } from 'neo4j-driver';

export let driver: Driver;
export let testDataManager: TestDataManager;
let projectionService: GdsProjectionService;

beforeAll(async () => {
  console.log('🔧 [GDS Setup] Starting shared setup for GDS tests...');

  driver = createDriver();
  testDataManager = new TestDataManager();
  projectionService = new GdsProjectionService(driver);

  // Clean database
  await withWriteSession(driver, async (tx) => {
    await tx.run('MATCH (n) DETACH DELETE n');
  });

  // Load U1-U7 test data ONCE
  const persistenceManager = new PersistenceManager(driver);
  const userKeys = testDataManager.getAvailableKeys();

  for (const userKey of userKeys) {
    const story = testDataManager.getStoryBy(userKey);
    await persistenceManager.upsertStory(story);
  }

  console.log(`✅ [GDS Setup] Loaded ${userKeys.length} test users (U1-U7)`);

  // Create projection ONCE for all tests (prevents race condition)
  // Since data never changes, projection remains valid for all tests
  await projectionService.ensureSkillsGraphProjection();
  console.log(`✅ [GDS Setup] Skills graph projection created`);
}, 60000); // 60s timeout for setup

// NOTE: No beforeEach with dropAllProjections!
// Since data is loaded ONCE in beforeAll and never reloaded,
// node IDs remain stable → projection is created once and reused.
// This enables parallel test execution without Bug #10 (stale node IDs).

afterAll(async () => {
  console.log('🧹 [GDS Setup] Cleaning up...');
  await projectionService.dropAllProjections();
  await driver.close();
}, 30000); // 30s timeout for cleanup
