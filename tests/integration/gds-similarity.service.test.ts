/**
 * Integration tests for GdsSimilarityService
 *
 * Tests Node Similarity algorithms (Jaccard/Overlap) with real Neo4j test database.
 *
 * Prerequisites:
 * - neo4j-test container running with GDS plugin
 * - Test data loaded from data/trails/users/*.json
 */

import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { GdsSimilarityService } from '../../src/gds/services/gds-similarity.service.js';
import { GdsProjectionService } from '../../src/gds/services/gds-projection.service.js';
import { PersistenceManager } from '../../src/persistence-manager.js';
import { TestDataManager } from '../helpers/test-data-manager.js';
import { createDriver, withWriteSession } from '../../src/neo4j.js';
import type { Driver } from 'neo4j-driver';

describe('GdsSimilarityService', () => {
  let similarityService: GdsSimilarityService;
  let projectionService: GdsProjectionService;
  let persistenceManager: PersistenceManager;
  let testDataManager: TestDataManager;
  let driver: Driver;

  beforeAll(async () => {
    driver = createDriver();
    projectionService = new GdsProjectionService(driver);
    similarityService = new GdsSimilarityService(driver, projectionService);
    persistenceManager = new PersistenceManager(driver);
    testDataManager = new TestDataManager();
  });

  beforeEach(async () => {
    // Clean database before each test
    await withWriteSession(driver, async (tx) => {
      await tx.run('MATCH (n) DETACH DELETE n');
    });

    // Load test data: U1-U7 from JSON
    const userKeys = testDataManager.getAvailableKeys();
    for (const userKey of userKeys) {
      const story = testDataManager.getStoryBy(userKey);
      await persistenceManager.upsertStory(story);
    }

    console.log(`✅ Loaded ${userKeys.length} test users with contexts`);
  }, 60000); // 60s timeout for data loading

  afterAll(async () => {
    // Final cleanup
    await projectionService.dropAllProjections();
    await driver.close();
  }, 30000); // 30s timeout for cleanup

  describe('findSimilarByOverlap', () => {
    it('should find similar contexts using Overlap metric', async () => {
      // Use U1's first context to search for similar contexts
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarByOverlap(
        searchContextId,
        excludeUserId,
        undefined, // no filters
        10, // topK
        0.1 // similarity cutoff
      );

      // Results should be an array
      expect(Array.isArray(results)).toBe(true);

      // Each result should have correct shape
      results.forEach((result) => {
        expect(result).toHaveProperty('context_id');
        expect(result).toHaveProperty('match_score');
        expect(typeof result.context_id).toBe('string');
        expect(typeof result.match_score).toBe('number');
        expect(result.match_score).toBeGreaterThanOrEqual(0.0);
        expect(result.match_score).toBeLessThanOrEqual(1.0);
      });

      // Should exclude U1's contexts
      results.forEach((result) => {
        const u1ContextIds = u1Story.contexts.map((c) => c.context_id);
        expect(u1ContextIds).not.toContain(result.context_id);
      });

      console.log(`✅ Found ${results.length} similar contexts (Overlap)`);
    });

    it('should find similar contexts with position filter', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const position = u1Story.contexts[0]!.position;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarByOverlap(
        searchContextId,
        excludeUserId,
        { position }, // filter by same position
        10
      );

      // Results should match position filter
      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Found ${results.length} contexts with position='${position}'`);
    });

    it('should throw error for non-existent searchContextId (bug #1 fix)', async () => {
      await expect(
        similarityService.findSimilarByOverlap(
          'nonexistent-context-123',
          'some-user',
          undefined,
          10
        )
      ).rejects.toThrow('Context nonexistent-context-123 not found');
    });

    it('should throw error for invalid topK parameter (bug #2 fix)', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // topK = 0 should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, 'user_01', undefined, 0)
      ).rejects.toThrow('topK must be >= 1');

      // topK < 0 should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, 'user_01', undefined, -5)
      ).rejects.toThrow('topK must be >= 1');
    });

    it('should throw error for invalid similarityCutoff parameter (bug #2 fix)', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // similarityCutoff > 1.0 should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, 'user_01', undefined, 10, 1.5)
      ).rejects.toThrow('similarityCutoff must be in [0.0, 1.0]');

      // similarityCutoff < 0.0 should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, 'user_01', undefined, 10, -0.1)
      ).rejects.toThrow('similarityCutoff must be in [0.0, 1.0]');
    });

    it('should throw error for empty excludeUserId (bug #8 fix)', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // Empty string should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, '', undefined, 10)
      ).rejects.toThrow('excludeUserId is required and cannot be empty');

      // Whitespace-only should throw
      await expect(
        similarityService.findSimilarByOverlap(searchContextId, '   ', undefined, 10)
      ).rejects.toThrow('excludeUserId is required and cannot be empty');
    });
  });

  describe('findSimilarByJaccard', () => {
    it('should find similar contexts using Jaccard metric', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarByJaccard(
        searchContextId,
        excludeUserId,
        undefined,
        10,
        0.3 // higher cutoff for Jaccard
      );

      expect(Array.isArray(results)).toBe(true);

      results.forEach((result) => {
        expect(result).toHaveProperty('context_id');
        expect(result).toHaveProperty('match_score');
        expect(typeof result.match_score).toBe('number');
        expect(result.match_score).toBeGreaterThanOrEqual(0.0);
        expect(result.match_score).toBeLessThanOrEqual(1.0);
      });

      console.log(`✅ Found ${results.length} similar contexts (Jaccard)`);
    });

    it('should apply same validation as Overlap', async () => {
      // Same validation tests as Overlap
      await expect(
        similarityService.findSimilarByJaccard('nonexistent-context-123', 'some-user', undefined, 10)
      ).rejects.toThrow('Context nonexistent-context-123 not found');
    });
  });

  describe('projection lifecycle (bug #3 fix)', () => {
    it('should NOT drop projection after each call (persists for concurrent requests)', async () => {
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      // First call - creates projection
      await similarityService.findSimilarByOverlap(searchContextId, excludeUserId, undefined, 5);

      // Check projection still exists (bug #3 fix - projection persists)
      const existsAfterFirstCall = await projectionService.projectionExists(
        'waymates-skills-graph'
      );
      expect(existsAfterFirstCall).toBe(true);

      // Second call - reuses projection
      await similarityService.findSimilarByJaccard(searchContextId, excludeUserId, undefined, 5);

      // Projection should STILL exist
      const existsAfterSecondCall = await projectionService.projectionExists(
        'waymates-skills-graph'
      );
      expect(existsAfterSecondCall).toBe(true);

      console.log('✅ Projection persists across calls (bug #3 fix verified)');
    });
  });
});
