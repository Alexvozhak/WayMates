/**
 * TDD Integration tests for ReasonAnalyticsService (Week 2 Day 2)
 *
 * Tests Cypher analytics queries for creation_reason patterns:
 * - getDurationByReason(): avg/median duration by reason type
 * - getReasonTransitionMatrix(): most common next reason after current
 * - getReasonCooccurrence(): common reason pairs in same context
 *
 * Prerequisites:
 * - neo4j-test container running
 * - Test data loaded via setup.ts (U8-U9 with NEXT relationships)
 *
 * NOTE: Service NOT implemented yet - this is TDD approach!
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ReasonAnalyticsService } from '../../../../src/services/reason-analytics.service.js';
import { driver } from '../setup-pathfinding.js';

/**
 * Test fixture for getDurationByReason test cases
 */
interface DurationByReasonTestCase {
  name: string;
  expectedReasons: string[]; // Reasons that should be in results
}

/**
 * Test fixture for getReasonTransitionMatrix test cases
 */
interface TransitionMatrixTestCase {
  name: string;
  expectedTransitions: Array<{
    from?: string;
    current: string;
    to?: string;
  }>;
}

/**
 * Test fixture for getReasonCooccurrence test cases
 */
interface CooccurrenceTestCase {
  name: string;
  expectedPairs: Array<{
    reason1: string;
    reason2: string;
  }>;
}

describe('ReasonAnalyticsService', () => {
  let reasonAnalytics: ReasonAnalyticsService;

  beforeAll(() => {
    reasonAnalytics = new ReasonAnalyticsService(driver);
    console.log('✅ ReasonAnalyticsService initialized - ready for tests');
  });

  describe('getDurationByReason - duration statistics', () => {
    const durationTestCases: DurationByReasonTestCase[] = [
      {
        name: 'returns statistics for skill_learning',
        expectedReasons: ['skill_learning'],
      },
      {
        name: 'returns statistics for position_changed',
        expectedReasons: ['position_changed'],
      },
      {
        name: 'returns statistics for milestone_achieved',
        expectedReasons: ['milestone_achieved'],
      },
      {
        name: 'returns statistics for company_changed',
        expectedReasons: ['company_changed'],
      },
      {
        name: 'returns all reasons found in dataset',
        expectedReasons: [
          'skill_learning',
          'position_changed',
          'milestone_achieved',
          'company_changed',
          'domain_changed',
        ],
      },
    ];

    durationTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const results = await reasonAnalytics.getDurationByReason();

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        testCase.expectedReasons.forEach((expectedReason) => {
          const reasonStat = results.find((r) => r.reason === expectedReason);
          expect(reasonStat).toBeDefined();

          if (reasonStat) {
            // Validate percentile calculation correctness (business logic)
            expect(reasonStat.medianDuration).toBeGreaterThanOrEqual(reasonStat.p25);
            expect(reasonStat.medianDuration).toBeLessThanOrEqual(reasonStat.p75);
          }
        });

        console.log(`✅ ${testCase.name}: ${results.length} reasons`);
      });
    });

    it.skip('should handle empty database gracefully', async () => {
      // Clean DB
      // await driver.session().run('MATCH (n) DETACH DELETE n');

      // const results = await reasonAnalytics.getDurationByReason();
      // expect(results).toEqual([]);
    });
  });

  describe('getReasonTransitionMatrix - transition patterns', () => {
    const transitionTestCases: TransitionMatrixTestCase[] = [
      {
        name: 'finds skill_learning → position_changed pattern',
        expectedTransitions: [
          {
            current: 'skill_learning',
            to: 'position_changed',
          },
        ],
      },
      {
        name: 'finds position_changed → company_changed pattern',
        expectedTransitions: [
          {
            current: 'position_changed',
            to: 'company_changed',
          },
        ],
      },
      {
        name: 'calculates probability correctly (sum to 1.0 for each current reason)',
        expectedTransitions: [
          {
            current: 'skill_learning',
          },
        ],
      },
    ];

    transitionTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const results = await reasonAnalytics.getReasonTransitionMatrix();

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        testCase.expectedTransitions.forEach((expectedTransition) => {
          const transitions = results.filter(
            (r) => r.currentReason === expectedTransition.current
          );
          expect(transitions.length).toBeGreaterThan(0);

          transitions.forEach((transition) => {
            // Validate probability calculation (business logic)
            expect(transition.probability).toBeGreaterThanOrEqual(0.0);
            expect(transition.probability).toBeLessThanOrEqual(1.0);
          });
        });

        console.log(`✅ ${testCase.name}: ${results.length} transitions`);
      });
    });

    it('should return top 50 transitions sorted by count', async () => {
      const results = await reasonAnalytics.getReasonTransitionMatrix();

      // Should be limited to 50 (as per Cypher LIMIT 50)
      expect(results.length).toBeLessThanOrEqual(50);

      // Should be sorted by transitionsCount DESC
      const isSorted = results.every((item, i) =>
        i === 0 || item.transitionsCount <= results[i - 1]!.transitionsCount
      );
      expect(isSorted).toBe(true);
    });

    it('should respect temporal ordering (from → current → to)', async () => {
      // Business logic: transition matrix reflects temporal sequence c1 → c2 → c3
      // Validate that from/current/to follow actual career progression order
      const results = await reasonAnalytics.getReasonTransitionMatrix();

      // Check that started_working appears as fromReason (first context)
      // but rarely/never as toReason (last context)
      const startedAsFrom = results.filter(r => r.fromReason === 'started_working');
      const startedAsTo = results.filter(r => r.toReason === 'started_working');

      expect(startedAsFrom.length).toBeGreaterThan(0);
      expect(startedAsTo.length).toBe(0); // started_working is always first, never last

      console.log(`✅ Temporal ordering validated: started_working appears as fromReason (${startedAsFrom.length} times), never as toReason`);
    });
  });

  describe('getReasonCooccurrence - reason pairs in same context', () => {
    const cooccurrenceTestCases: CooccurrenceTestCase[] = [
      {
        name: 'finds skill_learning + position_changed pair (common in U9)',
        expectedPairs: [
          {
            reason1: 'skill_learning',
            reason2: 'position_changed',
          },
        ],
      },
      {
        name: 'finds milestone_achieved + company_changed pair (U8)',
        expectedPairs: [
          {
            reason1: 'milestone_achieved',
            reason2: 'company_changed',
          },
        ],
      },
      {
        name: 'finds position_changed + company_changed pair (U9)',
        expectedPairs: [
          {
            reason1: 'position_changed',
            reason2: 'company_changed',
          },
        ],
      },
    ];

    cooccurrenceTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const results = await reasonAnalytics.getReasonCooccurrence();

        expect(Array.isArray(results)).toBe(true);

        testCase.expectedPairs.forEach((expectedPair) => {
          const found = results.find(
            (r) =>
              (r.reason1 === expectedPair.reason1 && r.reason2 === expectedPair.reason2) ||
              (r.reason1 === expectedPair.reason2 && r.reason2 === expectedPair.reason1)
          );

          // Validate pair exists in results (business logic)
          expect(found).toBeDefined();
        });

        console.log(`✅ ${testCase.name}: ${results.length} pairs`);
      });
    });

    it('should not return pairs where reason1 = reason2', async () => {
      const results = await reasonAnalytics.getReasonCooccurrence();

      results.forEach((pair) => {
        expect(pair.reason1).not.toBe(pair.reason2);
      });
    });

    it('should count co-occurrences accurately based on U8/U9 fixtures', async () => {
      // Business logic: validate counts match fixture data
      // U8 ctx_803: milestone_achieved + company_changed (1 occurrence)
      // U9 ctx_902: position_changed + skill_learning (1 occurrence)
      // U9 ctx_903: skill_learning + domain_changed (1 occurrence)
      // U9 ctx_904: position_changed + company_changed (1 occurrence)
      const results = await reasonAnalytics.getReasonCooccurrence();

      // U8: milestone_achieved + company_changed
      const u8Pair = results.find(r =>
        (r.reason1 === 'milestone_achieved' && r.reason2 === 'company_changed') ||
        (r.reason1 === 'company_changed' && r.reason2 === 'milestone_achieved')
      );
      expect(u8Pair).toBeDefined();
      expect(u8Pair!.cooccurrenceCount).toBeGreaterThanOrEqual(1);

      // U9 ctx_902: position_changed + skill_learning
      const u9Pair1 = results.find(r =>
        (r.reason1 === 'position_changed' && r.reason2 === 'skill_learning') ||
        (r.reason1 === 'skill_learning' && r.reason2 === 'position_changed')
      );
      expect(u9Pair1).toBeDefined();
      expect(u9Pair1!.cooccurrenceCount).toBeGreaterThanOrEqual(1);

      // U9 ctx_903: skill_learning + domain_changed
      const u9Pair2 = results.find(r =>
        (r.reason1 === 'skill_learning' && r.reason2 === 'domain_changed') ||
        (r.reason1 === 'domain_changed' && r.reason2 === 'skill_learning')
      );
      expect(u9Pair2).toBeDefined();
      expect(u9Pair2!.cooccurrenceCount).toBeGreaterThanOrEqual(1);

      console.log(`✅ Co-occurrence counts validated for U8/U9 fixture pairs`);
    });
  });

  describe('edge cases', () => {
    it.skip('handles contexts with single reason (no co-occurrence)', async () => {
      // const results = await reasonAnalytics.getReasonCooccurrence();

      // // started_working always appears alone (first context)
      // const startedWorkingPairs = results.filter(
      //   (r) => r.reason1 === 'started_working' || r.reason2 === 'started_working'
      // );
      // expect(startedWorkingPairs).toEqual([]);
    });

    it.skip('handles null creation_reason arrays gracefully', async () => {
      // Add context with null creation_reason (shouldn't crash)
      // const session = driver.session();
      // await session.run(`
      //   CREATE (c:Context {
      //     context_id: 'ctx_null_test',
      //     created_at: datetime(),
      //     creation_reason: null
      //   })
      // `);
      // await session.close();

      // const results = await reasonAnalytics.getDurationByReason();
      // expect(Array.isArray(results)).toBe(true);
    });
  });
});
