/**
 * ReasonAnalyticsService - analytics for creation_reason patterns
 *
 * Provides statistical insights into career transition reasons:
 * - getDurationByReason(): average/median duration by reason type
 * - getReasonTransitionMatrix(): transition probabilities between reasons
 * - getReasonCooccurrence(): common reason pairs in same context
 *
 * Week 2 Day 2 - GDS Module Implementation
 */

import { withReadSession } from "../neo4j.js";

import type { Driver } from "neo4j-driver";

/**
 * Duration statistics for a specific creation_reason
 */
export type DurationByReasonResult = {
  reason: string;
  avgDuration: number;
  medianDuration: number;
  p25: number; // 25th percentile
  p75: number; // 75th percentile
  minDuration: number;
  maxDuration: number;
  transitionsCount: number;
}

/**
 * Transition pattern: from_reason → current_reason → to_reason
 * with probability P(to_reason | current_reason)
 */
export type ReasonTransitionResult = {
  fromReason: string | null;
  currentReason: string;
  toReason: string | null;
  transitionsCount: number;
  probability: number; // [0.0, 1.0]
}

/**
 * Co-occurrence: reasons that appear together in same context
 */
export type ReasonCooccurrenceResult = {
  reason1: string;
  reason2: string;
  cooccurrenceCount: number;
  contextsWithBoth: number;
}

export class ReasonAnalyticsService {
  constructor(private readonly driver: Driver) {}

  /**
   * Get duration statistics by creation_reason type
   *
   * Returns average, median, percentiles, min, max for each reason.
   *
   * Example:
   * - skill_learning: avg 18mo, median 15mo, p25 12mo, p75 24mo
   * - position_changed: avg 12mo, median 12mo
   *
   * @returns Array of duration statistics per reason, sorted by avgDuration DESC
   */
  async getDurationByReason(): Promise<DurationByReasonResult[]> {
    return withReadSession(this.driver, async (tx) => {
      const result = await tx.run(`
        MATCH (c1:Context)-[n:NEXT]->(c2:Context)
        WHERE c2.creation_reason IS NOT NULL
        WITH c2.creation_reason AS reasons, n.duration_months AS durationMonths

        // Flatten reason arrays
        UNWIND reasons AS reason

        // Aggregate by reason
        WITH reason,
          avg(durationMonths) AS avgDuration,
          percentileCont(durationMonths, 0.5) AS medianDuration,
          percentileCont(durationMonths, 0.25) AS p25,
          percentileCont(durationMonths, 0.75) AS p75,
          min(durationMonths) AS minDuration,
          max(durationMonths) AS maxDuration,
          count(*) AS transitionsCount
        ORDER BY avgDuration DESC

        RETURN {
          reason: reason,
          avgDuration: avgDuration,
          medianDuration: medianDuration,
          p25: p25,
          p75: p75,
          minDuration: minDuration,
          maxDuration: maxDuration,
          transitionsCount: toInteger(transitionsCount)
        } AS result
      `);

      return result.records.map((record) => record.get("result") as DurationByReasonResult);
    });
  }

  /**
   * Get reason transition matrix: P(to_reason | current_reason)
   *
   * Analyzes 3-hop patterns: from_reason → current_reason → to_reason
   * Calculates probability of next reason given current reason.
   *
   * Example:
   * - from: started_working, current: skill_learning, to: position_changed (prob: 0.7)
   * - from: skill_learning, current: position_changed, to: company_changed (prob: 0.5)
   *
   * @returns Top 50 transitions sorted by count DESC
   */
  async getReasonTransitionMatrix(): Promise<ReasonTransitionResult[]> {
    return withReadSession(this.driver, async (tx) => {
      const result = await tx.run(`
        MATCH (c1:Context)-[:NEXT]->(c2:Context)-[:NEXT]->(c3:Context)
        WITH c1.creation_reason AS fromReasons,
          c2.creation_reason AS currentReasons,
          c3.creation_reason AS toReasons

        // Flatten arrays
        UNWIND fromReasons AS fromReason
        UNWIND currentReasons AS currentReason
        UNWIND toReasons AS toReason

        // Count transitions по (from → current → to)
        WITH fromReason, currentReason, toReason, count(*) AS totalTransitions

        // Double aggregation для probability (Neo4j не поддерживает OVER/PARTITION BY!)
        WITH currentReason,
             collect({from: fromReason, to: toReason, count: totalTransitions}) AS transitions,
             sum(totalTransitions) AS totalForCurrentReason

        // Развернуть и посчитать probability
        UNWIND transitions AS t
        WITH currentReason, t.from AS fromReason, t.to AS toReason,
             t.count AS totalTransitions, totalForCurrentReason
        ORDER BY totalTransitions DESC
        LIMIT 50

        RETURN {
          fromReason: fromReason,
          currentReason: currentReason,
          toReason: toReason,
          transitionsCount: toInteger(totalTransitions),
          probability: toFloat(totalTransitions) / totalForCurrentReason
        } AS result
      `);

      return result.records.map((record) => record.get("result") as ReasonTransitionResult);
    });
  }

  /**
   * Get co-occurring reasons (reasons that appear together in same context)
   *
   * Example:
   * - skill_learning + position_changed: 15 contexts
   * - position_changed + company_changed: 10 contexts
   *
   * Only returns ordered pairs (reason1 < reason2 alphabetically) to avoid duplicates.
   * Excludes contexts with single reason (no co-occurrence).
   *
   * @returns Array of reason pairs sorted by count DESC
   */
  async getReasonCooccurrence(): Promise<ReasonCooccurrenceResult[]> {
    return withReadSession(this.driver, async (tx) => {
      const result = await tx.run(`
        MATCH (c:Context)
        WHERE c.creation_reason IS NOT NULL AND size(c.creation_reason) > 1

        UNWIND c.creation_reason AS reason1
        UNWIND c.creation_reason AS reason2

        // Only unique ordered pairs (reason1 < reason2 alphabetically)
        WITH reason1, reason2
        WHERE reason1 < reason2

        WITH reason1, reason2, count(*) AS cooccurrenceCount
        ORDER BY cooccurrenceCount DESC

        RETURN {
          reason1: reason1,
          reason2: reason2,
          cooccurrenceCount: toInteger(cooccurrenceCount),
          contextsWithBoth: toInteger(cooccurrenceCount)
        } AS result
      `);

      return result.records.map((record) => record.get("result") as ReasonCooccurrenceResult);
    });
  }
}
