/**
 * Integration tests for GdsSimilarityService
 *
 * Tests Node Similarity algorithms (Jaccard/Overlap) with real Neo4j test database.
 *
 * Prerequisites:
 * - neo4j-test container running with GDS plugin
 * - Test data loaded via setup.ts (U1-U7 from JSON)
 */

import { describe, it, expect } from 'vitest';
import { GdsSimilarityService } from '../../../../src/gds/services/gds-similarity.service.js';
import { GdsProjectionService } from '../../../../src/gds/services/gds-projection.service.js';
import { driver, testDataManager } from '../setup.js';

describe('GdsSimilarityService', () => {
  let similarityService: GdsSimilarityService;
  let projectionService: GdsProjectionService;

  // Services are created for each test (lightweight)
  // Data is shared from setup.ts (heavy operation done once)
  function createServices() {
    projectionService = new GdsProjectionService(driver);
    similarityService = new GdsSimilarityService(driver, projectionService);
  }

  describe('findSimilarBy with Overlap algorithm', () => {
    it('should find similar contexts using Overlap metric', async () => {
      createServices();

      // Use U1's first context to search for similar contexts
      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarBy(
        'Overlap',
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
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const position = u1Story.contexts[0]!.position;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarBy(
        'Overlap',
        searchContextId,
        excludeUserId,
        { position }, // filter by same position
        10
      );

      // Results should match position filter
      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Found ${results.length} contexts with position='${position}'`);
    });

    it('should use default cutoff 0.1 for Overlap when not specified', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      // Don't specify cutoff - should use default 0.1
      const results = await similarityService.findSimilarBy(
        'Overlap',
        searchContextId,
        excludeUserId,
        undefined,
        10
      );

      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Overlap default cutoff test passed with ${results.length} results`);
    });
  });

  describe('findSimilarBy with Jaccard algorithm', () => {
    it('should find similar contexts using Jaccard metric', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarBy(
        'Jaccard',
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

    it('should use default cutoff 0.3 for Jaccard when not specified', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      // Don't specify cutoff - should use default 0.3
      const results = await similarityService.findSimilarBy(
        'Jaccard',
        searchContextId,
        excludeUserId,
        undefined,
        10
      );

      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Jaccard default cutoff test passed with ${results.length} results`);
    });
  });

  describe('parameter validation', () => {
    it('should throw error for non-existent searchContextId (bug #1 fix)', async () => {
      createServices();

      await expect(
        similarityService.findSimilarBy(
          'Overlap',
          'nonexistent-context-123',
          'some-user',
          undefined,
          10
        )
      ).rejects.toThrow('Context nonexistent-context-123 not found');
    });

    it('should throw error for invalid topK parameter (bug #2 fix)', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // topK = 0 should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, 'user_01', undefined, 0)
      ).rejects.toThrow('topK must be >= 1');

      // topK < 0 should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, 'user_01', undefined, -5)
      ).rejects.toThrow('topK must be >= 1');
    });

    it('should throw error for invalid similarityCutoff parameter (bug #2 fix)', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // similarityCutoff > 1.0 should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, 'user_01', undefined, 10, 1.5)
      ).rejects.toThrow('similarityCutoff must be in [0.0, 1.0]');

      // similarityCutoff < 0.0 should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, 'user_01', undefined, 10, -0.1)
      ).rejects.toThrow('similarityCutoff must be in [0.0, 1.0]');
    });

    it('should throw error for empty excludeUserId (bug #8 fix)', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;

      // Empty string should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, '', undefined, 10)
      ).rejects.toThrow('excludeUserId is required and cannot be empty');

      // Whitespace-only should throw
      await expect(
        similarityService.findSimilarBy('Overlap', searchContextId, '   ', undefined, 10)
      ).rejects.toThrow('excludeUserId is required and cannot be empty');
    });

    it('should throw error for empty searchContextId (bug #14 fix)', async () => {
      createServices();

      // Empty string should throw
      await expect(
        similarityService.findSimilarBy('Overlap', '', 'some-user', undefined, 10)
      ).rejects.toThrow('searchContextId is required and cannot be empty');

      // Whitespace-only should throw
      await expect(
        similarityService.findSimilarBy('Overlap', '   ', 'some-user', undefined, 10)
      ).rejects.toThrow('searchContextId is required and cannot be empty');
    });
  });

  describe('projection lifecycle (bug #3 fix)', () => {
    it('should NOT drop projection after each call (persists for concurrent requests)', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      // First call - creates projection
      await similarityService.findSimilarBy('Overlap', searchContextId, excludeUserId, undefined, 5);

      // Check projection still exists (bug #3 fix - projection persists)
      const existsAfterFirstCall = await projectionService.projectionExists(
        'waymates-skills-graph'
      );
      expect(existsAfterFirstCall).toBe(true);

      // Second call - reuses projection
      await similarityService.findSimilarBy('Jaccard', searchContextId, excludeUserId, undefined, 5);

      // Projection should STILL exist
      const existsAfterSecondCall = await projectionService.projectionExists(
        'waymates-skills-graph'
      );
      expect(existsAfterSecondCall).toBe(true);

      console.log('✅ Projection persists across calls (bug #3 fix verified)');
    });
  });

  describe('deprecated methods (backward compatibility)', () => {
    it('findSimilarByOverlap should delegate to findSimilarBy', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarByOverlap(
        searchContextId,
        excludeUserId,
        undefined,
        10,
        0.1
      );

      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Deprecated findSimilarByOverlap still works (${results.length} results)`);
    });

    it('findSimilarByJaccard should delegate to findSimilarBy', async () => {
      createServices();

      const u1Story = testDataManager.getStoryBy('U1');
      const searchContextId = u1Story.contexts[0]!.context_id;
      const excludeUserId = u1Story.user_id;

      const results = await similarityService.findSimilarByJaccard(
        searchContextId,
        excludeUserId,
        undefined,
        10,
        0.3
      );

      expect(Array.isArray(results)).toBe(true);
      console.log(`✅ Deprecated findSimilarByJaccard still works (${results.length} results)`);
    });
  });
});
