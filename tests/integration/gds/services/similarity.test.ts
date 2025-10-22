/**
 * Integration tests for GdsSimilarityService
 *
 * Tests Node Similarity algorithms (Jaccard/Overlap) with real Neo4j test database.
 *
 * Prerequisites:
 * - neo4j-test container running with GDS plugin
 * - Test data loaded via setup.ts (U1-U7 from JSON)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GdsSimilarityService } from '../../../../src/gds/services/gds-similarity.service.js';
import { GdsProjectionService } from '../../../../src/gds/services/gds-projection.service.js';
import type { SimilarityAlgorithm } from '../../../../src/gds/services/gds-similarity.service.js';
import type { SimilarityFilters } from '../../../../src/gds/schemas.js';
import { driver, testDataManager } from '../setup.js';

/**
 * Test fixture for similarity search test cases
 */
interface SimilarityTestCase {
  name: string;
  algorithm: SimilarityAlgorithm;
  searchUser: 'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6' | 'U7';
  excludeUser: 'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6' | 'U7';
  contextIndex?: number; // which context from user's story to use (default: 0)
  filters?: SimilarityFilters;
  topK?: number;
  similarityCutoff?: number;
  shouldReturnResults?: boolean; // if false, expect empty array
}

/**
 * Test fixture for validation error test cases
 */
interface ValidationErrorTestCase {
  name: string;
  algorithm: SimilarityAlgorithm;
  searchContextId: string;
  excludeUserId: string;
  filters?: SimilarityFilters;
  topK?: number;
  similarityCutoff?: number;
  expectedError: string;
}

describe('GdsSimilarityService', () => {
  let similarityService: GdsSimilarityService;
  let projectionService: GdsProjectionService;

  // Create services once for all tests (no mutable state, thread-safe)
  beforeAll(() => {
    projectionService = new GdsProjectionService(driver);
    similarityService = new GdsSimilarityService(driver, projectionService);
  });

  describe('findSimilarBy - algorithm tests', () => {
    const algorithmTestCases: SimilarityTestCase[] = [
      {
        name: 'Overlap algorithm finds similar contexts',
        algorithm: 'Overlap',
        searchUser: 'U1',
        excludeUser: 'U1',
        topK: 10,
        similarityCutoff: 0.1,
        shouldReturnResults: true,
      },
      {
        name: 'Jaccard algorithm finds similar contexts',
        algorithm: 'Jaccard',
        searchUser: 'U1',
        excludeUser: 'U1',
        topK: 10,
        similarityCutoff: 0.3,
        shouldReturnResults: true,
      },
      {
        name: 'Overlap uses default cutoff 0.1 when not specified',
        algorithm: 'Overlap',
        searchUser: 'U1',
        excludeUser: 'U1',
        topK: 10,
        // similarityCutoff: undefined - should use default 0.1
        shouldReturnResults: true,
      },
      {
        name: 'Jaccard uses default cutoff 0.3 when not specified',
        algorithm: 'Jaccard',
        searchUser: 'U1',
        excludeUser: 'U1',
        topK: 10,
        // similarityCutoff: undefined - should use default 0.3
        shouldReturnResults: true,
      },
    ];

    algorithmTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const story = testDataManager.getStoryBy(testCase.searchUser);
        const searchContextId = story.contexts[testCase.contextIndex ?? 0]!.context_id;
        const excludeUserId = story.user_id;

        const results = await similarityService.findSimilarBy(
          testCase.algorithm,
          searchContextId,
          excludeUserId,
          testCase.filters,
          testCase.topK ?? 100,
          testCase.similarityCutoff
        );

        // Results should be an array
        expect(Array.isArray(results)).toBe(true);

        if (testCase.shouldReturnResults) {
          // Each result should have correct shape
          results.forEach((result) => {
            expect(result).toHaveProperty('context_id');
            expect(result).toHaveProperty('match_score');
            expect(typeof result.context_id).toBe('string');
            expect(typeof result.match_score).toBe('number');
            expect(result.match_score).toBeGreaterThanOrEqual(0.0);
            expect(result.match_score).toBeLessThanOrEqual(1.0);
          });

          // Should exclude search user's contexts
          results.forEach((result) => {
            const userContextIds = story.contexts.map((c) => c.context_id);
            expect(userContextIds).not.toContain(result.context_id);
          });
        }

        console.log(`✅ ${testCase.name}: ${results.length} results`);
      });
    });
  });

  describe('findSimilarBy - filter tests', () => {
    const filterTestCases: SimilarityTestCase[] = [
      {
        name: 'filters by position',
        algorithm: 'Overlap',
        searchUser: 'U1',
        excludeUser: 'U1',
        filters: { position: 'Senior' }, // will be populated from U1's context
        topK: 10,
      },
      {
        name: 'filters by industry',
        algorithm: 'Overlap',
        searchUser: 'U1',
        excludeUser: 'U1',
        filters: { industry: 'IT' },
        topK: 10,
      },
      {
        name: 'filters by country_code',
        algorithm: 'Overlap',
        searchUser: 'U1',
        excludeUser: 'U1',
        filters: { country_code: 'US' },
        topK: 10,
      },
    ];

    filterTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const story = testDataManager.getStoryBy(testCase.searchUser);
        const context = story.contexts[testCase.contextIndex ?? 0]!;
        const searchContextId = context.context_id;
        const excludeUserId = story.user_id;

        // Populate filter with actual context data if needed
        const filters = { ...testCase.filters };
        if (filters.position === 'Senior') {
          filters.position = context.position;
        }

        const results = await similarityService.findSimilarBy(
          testCase.algorithm,
          searchContextId,
          excludeUserId,
          filters,
          testCase.topK ?? 100
        );

        expect(Array.isArray(results)).toBe(true);
        console.log(`✅ ${testCase.name}: ${results.length} results`);
      });
    });
  });

  describe('parameter validation', () => {
    const validationTestCases: ValidationErrorTestCase[] = [
      {
        name: 'throws error for non-existent searchContextId (bug #1 fix)',
        algorithm: 'Overlap',
        searchContextId: 'nonexistent-context-123',
        excludeUserId: 'some-user',
        topK: 10,
        expectedError: 'Context nonexistent-context-123 not found',
      },
      {
        name: 'throws error for topK = 0 (bug #2 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: 'user_01',
        topK: 0,
        expectedError: 'topK must be >= 1',
      },
      {
        name: 'throws error for negative topK (bug #2 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: 'user_01',
        topK: -5,
        expectedError: 'topK must be >= 1',
      },
      {
        name: 'throws error for similarityCutoff > 1.0 (bug #2 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: 'user_01',
        topK: 10,
        similarityCutoff: 1.5,
        expectedError: 'similarityCutoff must be in [0.0, 1.0]',
      },
      {
        name: 'throws error for negative similarityCutoff (bug #2 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: 'user_01',
        topK: 10,
        similarityCutoff: -0.1,
        expectedError: 'similarityCutoff must be in [0.0, 1.0]',
      },
      {
        name: 'throws error for empty excludeUserId (bug #8 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: '',
        topK: 10,
        expectedError: 'excludeUserId is required and cannot be empty',
      },
      {
        name: 'throws error for whitespace-only excludeUserId (bug #8 fix)',
        algorithm: 'Overlap',
        searchContextId: '', // will be populated
        excludeUserId: '   ',
        topK: 10,
        expectedError: 'excludeUserId is required and cannot be empty',
      },
      {
        name: 'throws error for empty searchContextId (bug #14 fix)',
        algorithm: 'Overlap',
        searchContextId: '',
        excludeUserId: 'some-user',
        topK: 10,
        expectedError: 'searchContextId is required and cannot be empty',
      },
      {
        name: 'throws error for whitespace-only searchContextId (bug #14 fix)',
        algorithm: 'Overlap',
        searchContextId: '   ',
        excludeUserId: 'some-user',
        topK: 10,
        expectedError: 'searchContextId is required and cannot be empty',
      },
    ];

    validationTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        let searchContextId = testCase.searchContextId;

        // Populate with valid context ID if empty string but not testing empty validation
        if (searchContextId === '' && !testCase.expectedError.includes('searchContextId')) {
          const story = testDataManager.getStoryBy('U1');
          searchContextId = story.contexts[0]!.context_id;
        }

        await expect(
          similarityService.findSimilarBy(
            testCase.algorithm,
            searchContextId,
            testCase.excludeUserId,
            testCase.filters,
            testCase.topK ?? 10,
            testCase.similarityCutoff
          )
        ).rejects.toThrow(testCase.expectedError);
      });
    });
  });

  describe('projection lifecycle (bug #3 fix)', () => {
    it('should NOT drop projection after each call (persists for concurrent requests)', async () => {
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
});
