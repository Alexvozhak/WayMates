import type { ScoredMatchedCandidate } from "../../shared/schemas.js";
import type {
  ChartableField,
  FullOverlapPeriod,
  OverlapPeriod,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
  TrajectoryPoint,
} from "../types.js";

/**
 * Check and add overlap if values match and periods intersect.
 */
function checkAndAddOverlap(
  userPoint: TrajectoryPoint,
  userNext: TrajectoryPoint,
  candPoint: TrajectoryPoint,
  candNext: TrajectoryPoint,
  userValue: string | number,
  candidateId: string,
  field: ChartableField,
  overlaps: OverlapPeriod[],
): void {
  const candValue = candPoint.values[field];
  if (candValue !== userValue) return;

  const overlapStart = Math.max(userPoint.timestamp, candPoint.timestamp);
  const overlapEnd = Math.min(userNext.timestamp, candNext.timestamp);

  if (overlapStart < overlapEnd) {
    overlaps.push({
      candidateId,
      field,
      startTime: overlapStart,
      endTime: overlapEnd,
      value: userValue,
    });
  }
}

/**
 * Find overlaps for a single field between user and candidate points.
 */
function findFieldOverlaps(
  field: ChartableField,
  userPoints: TrajectoryPoint[],
  candPoints: TrajectoryPoint[],
  candidateId: string,
): OverlapPeriod[] {
  const overlaps: OverlapPeriod[] = [];

  for (let userIndex = 0; userIndex < userPoints.length - 1; userIndex++) {
    const userPoint = userPoints[userIndex]!;
    const userNext = userPoints[userIndex + 1]!;
    const userValue = userPoint.values[field];

    if (userValue === null || userValue === undefined) {
      continue;
    }

    for (let candIndex = 0; candIndex < candPoints.length - 1; candIndex++) {
      checkAndAddOverlap(
        userPoint,
        userNext,
        candPoints[candIndex]!,
        candPoints[candIndex + 1]!,
        userValue,
        candidateId,
        field,
        overlaps,
      );
    }
  }

  return overlaps;
}

/**
 * Find overlap periods where user and candidate had same field values.
 * Overlaps indicate shared career experiences (same city, domain, etc).
 */
export function findOverlapPeriods(
  user: ProcessedTrajectory,
  candidate: ProcessedTrajectory,
  fields: ChartableField[],
): OverlapPeriod[] {
  const overlaps: OverlapPeriod[] = [];

  for (const field of fields) {
    const fieldOverlaps = findFieldOverlaps(field, user.points, candidate.points, candidate.id);
    overlaps.push(...fieldOverlaps);
  }

  return overlaps;
}

/**
 * Calculate similarity metrics for candidate.
 * Uses DTW metrics if available, otherwise returns placeholder.
 */
export function calculateSimilarity(
  candidate: ProcessedTrajectory,
  scoredCandidate: ScoredMatchedCandidate,
): SimilarityMetrics {
  const { dtwMetrics, candidateType } = scoredCandidate;

  if (!dtwMetrics) {
    return {
      candidateId: candidate.id,
      candidateType,
      perField: {},
      overall: 0,
    };
  }

  const { shapeSimilarity, tempoSimilarity, stabilityScore } = dtwMetrics;

  return {
    candidateId: candidate.id,
    candidateType,
    perField: {
      position: shapeSimilarity,
      domains: tempoSimilarity,
      cityName: stabilityScore,
    },
    overall: shapeSimilarity + tempoSimilarity + stabilityScore,
  };
}

// ==========================================
// === FULL OVERLAP (ALL FIELDS MATCH) ===
// ==========================================

const MS_PER_DAY = 86_400_000;

/**
 * Intersect two time intervals.
 * Returns null if no intersection.
 */
function intersectIntervals(
  a: { start: number; end: number },
  b: { start: number; end: number },
): { start: number; end: number } | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/**
 * Build time intervals for each field from per-field overlaps.
 */
function buildFieldIntervals(
  overlaps: OverlapPeriod[],
  fields: ChartableField[],
): Map<ChartableField, { start: number; end: number }[]> {
  const fieldIntervals = new Map<ChartableField, { start: number; end: number }[]>();
  for (const field of fields) {
    fieldIntervals.set(field, []);
  }
  for (const overlap of overlaps) {
    const intervals = fieldIntervals.get(overlap.field);
    if (intervals) {
      intervals.push({ start: overlap.startTime, end: overlap.endTime });
    }
  }
  return fieldIntervals;
}

/**
 * Find full overlap periods where ALL selected fields match simultaneously.
 * Returns periods where user and candidate had identical values for all fields.
 */
// eslint-disable-next-line complexity
export function findFullOverlapPeriods(
  user: ProcessedTrajectory,
  candidate: ProcessedTrajectory,
  fields: ChartableField[],
): FullOverlapPeriod[] {
  if (fields.length === 0) return [];

  const perFieldOverlaps = findOverlapPeriods(user, candidate, fields);
  const fieldIntervals = buildFieldIntervals(perFieldOverlaps, fields);
  const firstField = fields[0]!;
  let result = fieldIntervals.get(firstField) ?? [];

  for (let i = 1; i < fields.length; i++) {
    const nextIntervals = fieldIntervals.get(fields[i]!) ?? [];
    const intersected: { start: number; end: number }[] = [];

    /* eslint-disable max-depth */
    for (const a of result) {
      for (const b of nextIntervals) {
        const inter = intersectIntervals(a, b);
        if (inter) intersected.push(inter);
      }
    }
    /* eslint-enable max-depth */
    result = intersected;
    if (result.length === 0) break;
  }

  return result.map(({ start, end }) => ({
    candidateId: candidate.id,
    startTime: start,
    endTime: end,
  }));
}

/**
 * Calculate overlap summary for a candidate.
 * Computes total days and longest streak from full overlap periods.
 */
export function calculateOverlapSummary(
  candidate: ProcessedTrajectory,
  fullPeriods: FullOverlapPeriod[],
): OverlapSummary {
  let totalMs = 0;
  let longestMs = 0;

  for (const period of fullPeriods) {
    const duration = period.endTime - period.startTime;
    totalMs += duration;
    if (duration > longestMs) longestMs = duration;
  }

  return {
    candidateId: candidate.id,
    candidateLabel: candidate.label,
    candidateColor: candidate.color,
    periods: fullPeriods,
    totalDays: Math.round(totalMs / MS_PER_DAY),
    longestStreakDays: Math.round(longestMs / MS_PER_DAY),
  };
}

/**
 * Calculate overlap summaries for all candidates.
 */
export function calculateAllOverlapSummaries(
  user: ProcessedTrajectory,
  candidates: ProcessedTrajectory[],
  fields: ChartableField[],
): OverlapSummary[] {
  return candidates.map((candidate) => {
    const fullPeriods = findFullOverlapPeriods(user, candidate, fields);
    return calculateOverlapSummary(candidate, fullPeriods);
  });
}
