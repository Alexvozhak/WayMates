import { ARRAY_OVERLAP_FIELDS } from "../types.js";

import type { WaymateCandidate } from "../../shared/schemas.js";
import type {
  ChartableField,
  FullOverlapPeriod,
  OverlapPeriod,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
  TrajectoryPoint,
} from "../types.js";

const MS_PER_DAY = 86_400_000;

type Interval = { start: number; end: number };

/**
 * Calculates overlap periods and similarity metrics between user and candidate trajectories.
 * Handles both per-field overlaps and full (all-fields) overlaps.
 */
export class OverlapCalculator {
  constructor(
    private readonly userTrajectory: ProcessedTrajectory,
    private readonly candidateTrajectories: ProcessedTrajectory[],
    private readonly fields: ChartableField[],
  ) {}

  /**
   * Calculate overlap summaries for all candidates.
   */
  calculateOverlapSummaries(): OverlapSummary[] {
    return this.candidateTrajectories.map((candidate) => this.calculateSummaryForCandidate(candidate));
  }

  /**
   * Calculate similarity metrics using DTW data from scored candidates.
   */
  calculateSimilarityMetrics(scoredCandidates: WaymateCandidate[]): SimilarityMetrics[] {
    return this.candidateTrajectories.map((trajectory, index) => {
      const scored = scoredCandidates[index];
      if (!scored) {
        return this.createEmptyMetrics(trajectory);
      }
      return this.createMetricsFromDtw(trajectory, scored);
    });
  }

  private calculateSummaryForCandidate(candidate: ProcessedTrajectory): OverlapSummary {
    const periods = this.findFullOverlapPeriods(candidate);
    const { totalMs, longestMs } = this.aggregatePeriodDurations(periods);

    return {
      candidateId: candidate.id,
      candidateLabel: candidate.label,
      candidateColor: candidate.color,
      periods,
      totalDays: Math.round(totalMs / MS_PER_DAY),
      longestStreakDays: Math.round(longestMs / MS_PER_DAY),
    };
  }

  private findFullOverlapPeriods(candidate: ProcessedTrajectory): FullOverlapPeriod[] {
    if (this.fields.length === 0) return [];

    const fieldIntervals = this.buildFieldIntervalsMap(candidate);
    const intersected = this.intersectAllFieldIntervals(fieldIntervals);

    return intersected.map(({ start, end }) => ({
      candidateId: candidate.id,
      startTime: start,
      endTime: end,
    }));
  }

  private buildFieldIntervalsMap(candidate: ProcessedTrajectory): Map<ChartableField, Interval[]> {
    const map = new Map<ChartableField, Interval[]>();

    for (const field of this.fields) {
      const overlaps = this.findFieldOverlaps(candidate, field);
      const intervals = overlaps.map((o) => ({ start: o.startTime, end: o.endTime }));
      map.set(field, intervals);
    }

    return map;
  }

  private intersectAllFieldIntervals(fieldIntervals: Map<ChartableField, Interval[]>): Interval[] {
    const firstField = this.fields[0]!;
    let result = fieldIntervals.get(firstField) ?? [];

    for (let i = 1; i < this.fields.length; i++) {
      const nextIntervals = fieldIntervals.get(this.fields[i]!) ?? [];
      result = this.intersectIntervalArrays(result, nextIntervals);
      if (result.length === 0) break;
    }

    return result;
  }

  private findFieldOverlaps(candidate: ProcessedTrajectory, field: ChartableField): OverlapPeriod[] {
    const overlaps: OverlapPeriod[] = [];
    const userPoints = this.userTrajectory.points;

    for (let ui = 0; ui < userPoints.length - 1; ui++) {
      const userPoint = userPoints[ui]!;
      const userNext = userPoints[ui + 1]!;
      const userValue = userPoint.values[field];

      if (userValue === null || userValue === undefined) continue;

      const candidateOverlaps = this.findCandidateOverlaps(candidate, userPoint, userNext, userValue, field);
      overlaps.push(...candidateOverlaps);
    }

    return overlaps;
  }

  private findCandidateOverlaps(
    candidate: ProcessedTrajectory,
    userPoint: TrajectoryPoint,
    userNext: TrajectoryPoint,
    userValue: string | number,
    field: ChartableField,
  ): OverlapPeriod[] {
    const overlaps: OverlapPeriod[] = [];
    const candPoints = candidate.points;

    for (let ci = 0; ci < candPoints.length - 1; ci++) {
      const overlap = this.checkOverlap(userPoint, userNext, candPoints[ci]!, candPoints[ci + 1]!, userValue, field);
      if (overlap) {
        overlaps.push({ ...overlap, candidateId: candidate.id });
      }
    }

    return overlaps;
  }

  private checkOverlap(
    userPoint: TrajectoryPoint,
    userNext: TrajectoryPoint,
    candPoint: TrajectoryPoint,
    candNext: TrajectoryPoint,
    userValue: string | number,
    field: ChartableField,
  ): Omit<OverlapPeriod, "candidateId"> | null {
    const valuesMatch = this.checkFieldMatch(userPoint, candPoint, userValue, field);
    if (!valuesMatch) return null;

    const overlapStart = Math.max(userPoint.timestamp, candPoint.timestamp);
    const overlapEnd = Math.min(userNext.timestamp, candNext.timestamp);

    if (overlapStart >= overlapEnd) return null;

    return {
      field,
      startTime: overlapStart,
      endTime: overlapEnd,
      value: userValue,
    };
  }

  /**
   * Check if field values match. For array fields (e.g., domains), uses intersection.
   */
  private checkFieldMatch(
    userPoint: TrajectoryPoint,
    candPoint: TrajectoryPoint,
    userValue: string | number,
    field: ChartableField,
  ): boolean {
    if (ARRAY_OVERLAP_FIELDS.includes(field)) {
      return this.checkArrayIntersection(userPoint, candPoint, field);
    }
    return candPoint.values[field] === userValue;
  }

  /**
   * Check if rawArrays have any intersection for the given field.
   */
  private checkArrayIntersection(
    userPoint: TrajectoryPoint,
    candPoint: TrajectoryPoint,
    field: ChartableField,
  ): boolean {
    const userArray = userPoint.rawArrays?.[field] ?? [];
    const candArray = candPoint.rawArrays?.[field] ?? [];
    if (userArray.length === 0 || candArray.length === 0) return false;
    const candSet = new Set(candArray);
    return userArray.some((v) => candSet.has(v));
  }

  private intersectIntervalArrays(a: Interval[], b: Interval[]): Interval[] {
    return a.flatMap((ia) => this.findIntersectionsForInterval(ia, b));
  }

  private findIntersectionsForInterval(interval: Interval, others: Interval[]): Interval[] {
    const intersections: Interval[] = [];

    for (const other of others) {
      const intersection = this.intersectTwoIntervals(interval, other);
      if (intersection) {
        intersections.push(intersection);
      }
    }

    return intersections;
  }

  private intersectTwoIntervals(a: Interval, b: Interval): Interval | null {
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    return start < end ? { start, end } : null;
  }

  private aggregatePeriodDurations(periods: FullOverlapPeriod[]): { totalMs: number; longestMs: number } {
    let totalMs = 0;
    let longestMs = 0;

    for (const period of periods) {
      const duration = period.endTime - period.startTime;
      totalMs += duration;
      if (duration > longestMs) longestMs = duration;
    }

    return { totalMs, longestMs };
  }

  private createEmptyMetrics(trajectory: ProcessedTrajectory): SimilarityMetrics {
    return {
      candidateId: trajectory.id,
      isWaymate: trajectory.isWaymate,
      perField: {},
      overall: 0,
    };
  }

  private createMetricsFromDtw(trajectory: ProcessedTrajectory, scored: WaymateCandidate): SimilarityMetrics {
    const { dtwMetrics, isWaymate } = scored;

    if (!dtwMetrics) {
      return this.createEmptyMetrics(trajectory);
    }

    const { shapeSimilarity, tempoSimilarity, alignmentScore } = dtwMetrics;

    return {
      candidateId: trajectory.id,
      isWaymate,
      perField: {
        position: shapeSimilarity,
        domains: tempoSimilarity,
        cityName: alignmentScore,
      },
      overall: shapeSimilarity + tempoSimilarity + alignmentScore,
    };
  }
}
