import type { ScoredMatchedCandidate } from "../../shared/schemas.js";
import type {
  ChartableField,
  OverlapPeriod,
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
