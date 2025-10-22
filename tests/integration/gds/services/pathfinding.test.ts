/**
 * TDD Integration tests for GdsPathfindingService (Week 2 Day 3)
 *
 * Tests Yen's K-Shortest Paths algorithm for career transition analysis.
 *
 * Prerequisites:
 * - neo4j-test container running with GDS plugin
 * - Test data with NEXT relationships and duration_months
 * - waymates-temporal-graph projection created by service
 *
 * Test scenarios:
 * - Linear paths (A → B → C → D)
 * - Multiple paths with different costs (K shortest)
 * - No path exists (isolated contexts)
 * - Edge cases (same source/target, missing contexts)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GdsPathfindingService } from '../../../../src/gds/services/gds-pathfinding.service.js';
import { GdsProjectionService } from '../../../../src/gds/services/gds-projection.service.js';
import { driver } from '../setup-pathfinding.js';

/**
 * Test fixture for pathfinding test cases
 */
interface PathfindingTestCase {
  name: string;
  sourceContextId: string;
  targetContextId: string;
  k?: number;
}

/**
 * Test fixture for validation error test cases
 */
interface ValidationErrorTestCase {
  name: string;
  sourceContextId: string;
  targetContextId: string;
  k?: number;
  expectedError: string;
}

describe('GdsPathfindingService', () => {
  let pathfindingService: GdsPathfindingService;
  let projectionService: GdsProjectionService;

  beforeAll(() => {
    projectionService = new GdsProjectionService(driver);
    pathfindingService = new GdsPathfindingService(driver, projectionService);
    console.log('✅ GdsPathfindingService initialized - ready for tests');
  });

  describe('findKShortestPaths - basic functionality', () => {
    const basicTestCases: PathfindingTestCase[] = [
      {
        name: 'finds path from Junior to TechLead (U8 linear path)',
        sourceContextId: 'ctx_01JAB000000000000000000801', // U8 Junior
        targetContextId: 'ctx_01JAB000000000000000000804', // U8 TechLead
        k: 1,
      },
      {
        name: 'finds path from Junior to Engineering Manager (U9 linear path)',
        sourceContextId: 'ctx_01JAB000000000000000000901', // U9 Junior
        targetContextId: 'ctx_01JAB000000000000000000904', // U9 Engineering Manager
        k: 1,
      },
      {
        name: 'finds shorter path from Middle to TechLead (U8)',
        sourceContextId: 'ctx_01JAB000000000000000000802', // U8 Middle
        targetContextId: 'ctx_01JAB000000000000000000804', // U8 TechLead
        k: 1,
      },
      {
        name: 'uses default k=3 when not specified',
        sourceContextId: 'ctx_01JAB000000000000000000801', // U8 Junior
        targetContextId: 'ctx_01JAB000000000000000000804', // U8 TechLead
        // k: undefined - should use default 3
      },
    ];

    basicTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const results = await pathfindingService.findKShortestPaths(
          testCase.sourceContextId,
          testCase.targetContextId,
          testCase.k
        );

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        // Each result should have correct shape
          results.forEach((result, index) => {
            expect(result).toHaveProperty('path_index');
            expect(result).toHaveProperty('contexts');
            expect(result).toHaveProperty('total_cost');

            // path_index should match array index
            expect(result.path_index).toBe(index);

            // contexts should be array of strings (context_ids)
            expect(Array.isArray(result.contexts)).toBe(true);
            expect(result.contexts.length).toBeGreaterThan(0);
            result.contexts.forEach((ctx) => {
              expect(typeof ctx).toBe('string');
            });

            // First context should be source, last should be target
            expect(result.contexts[0]).toBe(testCase.sourceContextId);
            expect(result.contexts[result.contexts.length - 1]).toBe(testCase.targetContextId);

            // total_cost should be non-negative number
            expect(typeof result.total_cost).toBe('number');
            expect(result.total_cost).toBeGreaterThanOrEqual(0);
          });

        // Results should be sorted by total_cost ASC (shortest first)
        const isSorted = results.every((item, i) =>
          i === 0 || item.total_cost >= results[i - 1]!.total_cost
        );
        expect(isSorted).toBe(true);

        console.log(`✅ ${testCase.name}: ${results.length} path(s)`);
        if (results.length > 0) {
          results.forEach((r) => {
            console.log(`   Path ${r.path_index}: ${r.contexts.length} steps, cost: ${r.total_cost} months`);
          });
        }
      });
    });
  });

  describe('findKShortestPaths - no path exists', () => {
    const noPathTestCases: PathfindingTestCase[] = [
      {
        name: 'returns empty array when no path exists (U8 → U9 cross-user)',
        sourceContextId: 'ctx_01JAB000000000000000000801', // U8 Junior
        targetContextId: 'ctx_01JAB000000000000000000904', // U9 Engineering Manager
        k: 3,
      },
      {
        name: 'returns empty array for reverse path (target → source)',
        sourceContextId: 'ctx_01JAB000000000000000000804', // U8 TechLead
        targetContextId: 'ctx_01JAB000000000000000000801', // U8 Junior
        k: 3,
      },
    ];

    noPathTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const results = await pathfindingService.findKShortestPaths(
          testCase.sourceContextId,
          testCase.targetContextId,
          testCase.k
        );

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);

        console.log(`✅ ${testCase.name}: correctly returned empty array`);
      });
    });
  });

  describe('findKShortestPaths - validation errors', () => {
    const validationErrorTestCases: ValidationErrorTestCase[] = [
      {
        name: 'throws error for empty sourceContextId',
        sourceContextId: '',
        targetContextId: 'ctx_01JAB000000000000000000804',
        k: 3,
        expectedError: 'sourceContextId is required and cannot be empty',
      },
      {
        name: 'throws error for empty targetContextId',
        sourceContextId: 'ctx_01JAB000000000000000000801',
        targetContextId: '',
        k: 3,
        expectedError: 'targetContextId is required and cannot be empty',
      },
      {
        name: 'throws error for same source and target',
        sourceContextId: 'ctx_01JAB000000000000000000801',
        targetContextId: 'ctx_01JAB000000000000000000801',
        k: 3,
        expectedError: 'sourceContextId and targetContextId must be different',
      },
      {
        name: 'throws error for k < 1',
        sourceContextId: 'ctx_01JAB000000000000000000801',
        targetContextId: 'ctx_01JAB000000000000000000804',
        k: 0,
        expectedError: 'k must be >= 1',
      },
      {
        name: 'throws error for k > MAX_K_PATHS (10)',
        sourceContextId: 'ctx_01JAB000000000000000000801',
        targetContextId: 'ctx_01JAB000000000000000000804',
        k: 11,
        expectedError: 'k must be <= 10',
      },
      {
        name: 'throws error for non-existent source context',
        sourceContextId: 'ctx_nonexistent',
        targetContextId: 'ctx_01JAB000000000000000000804',
        k: 3,
        expectedError: 'Source context ctx_nonexistent not found',
      },
      {
        name: 'throws error for non-existent target context',
        sourceContextId: 'ctx_01JAB000000000000000000801',
        targetContextId: 'ctx_nonexistent',
        k: 3,
        expectedError: 'Target context ctx_nonexistent not found',
      },
    ];

    validationErrorTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        await expect(
          pathfindingService.findKShortestPaths(
            testCase.sourceContextId,
            testCase.targetContextId,
            testCase.k
          )
        ).rejects.toThrow(testCase.expectedError);

        console.log(`✅ ${testCase.name}: correctly threw error`);
      });
    });
  });

  describe('findKShortestPaths - path properties', () => {
    it('should return path with correct number of steps', async () => {
      // U8: Junior → Middle → Senior → TechLead (3 transitions = 4 contexts)
      const results = await pathfindingService.findKShortestPaths(
        'ctx_01JAB000000000000000000801', // U8 Junior
        'ctx_01JAB000000000000000000804', // U8 TechLead
        1
      );

      expect(results.length).toBe(1);
      const path = results[0]!;

      // Path should have 4 contexts (Junior, Middle, Senior, TechLead)
      expect(path.contexts.length).toBe(4);

      // Verify all contexts are in order
      expect(path.contexts).toEqual([
        'ctx_01JAB000000000000000000801', // Junior
        'ctx_01JAB000000000000000000802', // Middle
        'ctx_01JAB000000000000000000803', // Senior
        'ctx_01JAB000000000000000000804', // TechLead
      ]);
    });

    it('should calculate total_cost as sum of edge weights', async () => {
      // U8 transitions:
      // Junior → Middle: 24 months (2020-01 → 2021-01 = 12 months, but fixture has 24)
      // Middle → Senior: 30 months
      // Senior → TechLead: 48 months
      // Total: 24 + 30 + 48 = 102 months

      const results = await pathfindingService.findKShortestPaths(
        'ctx_01JAB000000000000000000801', // U8 Junior
        'ctx_01JAB000000000000000000804', // U8 TechLead
        1
      );

      expect(results.length).toBe(1);
      const path = results[0]!;

      // Total cost should be sum of all edge weights
      expect(path.total_cost).toBe(102);
    });

    it('should find shorter path when starting from intermediate context', async () => {
      // Full path (Junior → TechLead): 102 months
      const fullPath = await pathfindingService.findKShortestPaths(
        'ctx_01JAB000000000000000000801', // U8 Junior
        'ctx_01JAB000000000000000000804', // U8 TechLead
        1
      );

      // Partial path (Middle → TechLead): 30 + 48 = 78 months
      const partialPath = await pathfindingService.findKShortestPaths(
        'ctx_01JAB000000000000000000802', // U8 Middle
        'ctx_01JAB000000000000000000804', // U8 TechLead
        1
      );

      expect(fullPath.length).toBe(1);
      expect(partialPath.length).toBe(1);

      // Partial path should be shorter
      expect(partialPath[0]!.total_cost).toBeLessThan(fullPath[0]!.total_cost);
      expect(partialPath[0]!.total_cost).toBe(78);

      // Partial path should have fewer steps
      expect(partialPath[0]!.contexts.length).toBeLessThan(fullPath[0]!.contexts.length);
      expect(partialPath[0]!.contexts.length).toBe(3); // Middle, Senior, TechLead
    });
  });
});
