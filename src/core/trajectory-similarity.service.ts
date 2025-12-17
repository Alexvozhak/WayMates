import DynamicTimeWarping from "dynamic-time-warping";

import type { DTWMetrics, UserContext } from "../shared/schemas.js";

type StepWithDuration = {
  context: UserContext;
  duration: number;
};

export class TrajectorySimilarityService {
  /**
   * Compute all DTW metrics synchronously
   * NOTE: Synchronous because DTW is pure CPU-bound computation (no I/O)
   *
   * Performance optimizations:
   * - StepWithDuration wrappers created once (not separately)
   * - DTW computed once for Shape+Stability (not twice)
   */
  computeDTWMetrics(userTrajectory: UserContext[], candidateTrajectory: UserContext[]): DTWMetrics {
    // 1. Create StepWithDuration wrappers once (for Shape + Stability)
    const userSteps = this.calculateStepsWithDuration(userTrajectory);
    const candidateSteps = this.calculateStepsWithDuration(candidateTrajectory);

    // 2. Compute DTW once (for Shape + Stability metrics)
    const dtw = new DynamicTimeWarping(userSteps, candidateSteps, (a: StepWithDuration, b: StepWithDuration) =>
      this.trajectoryDistance(a.context, b.context, a.duration, b.duration),
    );

    const distance = dtw.getDistance();
    const pathLength = dtw.getPath().length;

    this.validatePathLength(pathLength, userTrajectory.length, candidateTrajectory.length);

    // 4. Compute Shape and Stability from cached DTW result
    const shapeSimilarity = 1 / (1 + distance / pathLength);

    // Stability: userLength / pathLength
    // Measures how compressed user's trajectory is in DTW alignment
    // Higher score = less warping needed (more stable)
    // User trajectory is always baseline
    const stabilityScore = userTrajectory.length / pathLength;

    // 4. Compute Tempo (separate DTW on derivatives)
    const userDurations = userSteps.map((step) => step.duration);
    const candidateDurations = candidateSteps.map((step) => step.duration);
    const tempoSimilarity = this.computeTempoSimilarity(
      userDurations,
      candidateDurations,
      userTrajectory.length,
      candidateTrajectory.length,
    );

    return {
      shapeSimilarity,
      tempoSimilarity,
      stabilityScore,
    };
  }

  /**
   * Compute tempo similarity using derivative DTW
   * NOTE: Private - only called from computeDTWMetrics with cached durations
   */
  private computeTempoSimilarity(
    userDurations: number[],
    candidateDurations: number[],
    userTrajectoryLength: number,
    candidateTrajectoryLength: number,
  ): number {
    const userDeriv = this.derivative(userDurations);
    const candidateDeriv = this.derivative(candidateDurations);

    const dtw = new DynamicTimeWarping(userDeriv, candidateDeriv, (a: number, b: number) => Math.abs(a - b));

    const distance = dtw.getDistance();
    const pathLength = dtw.getPath().length;

    this.validatePathLength(pathLength, userTrajectoryLength, candidateTrajectoryLength);

    // Normalize: distance/pathLength = avg derivative difference per step
    // Transform to similarity [0,1]: 1/(1+avg)
    return 1 / (1 + distance / pathLength);
  }

  /**
   * Validate DTW path length (guard against library bugs)
   */
  private validatePathLength(
    pathLength: number,
    userTrajectoryLength: number,
    candidateTrajectoryLength: number,
  ): void {
    const minExpectedPath = Math.max(userTrajectoryLength, candidateTrajectoryLength);

    if (pathLength === 0) {
      throw new Error(
        `DTW path length is zero (library bug or identical trajectories). ` +
          `User trajectory: ${userTrajectoryLength} steps, ` +
          `Candidate trajectory: ${candidateTrajectoryLength} steps.`,
      );
    }

    if (pathLength < minExpectedPath) {
      throw new Error(
        `DTW path length (${pathLength}) is less than max trajectory length (${minExpectedPath}). ` +
          `This indicates DTW library bug or incorrect distance function.`,
      );
    }
  }

  /**
   * Create StepWithDuration array from trajectory
   * Calculates duration (in months) for each context using 30-day month approximation
   *
   * Duration: time from this context to next (or to now if last context)
   * Validates chronological order: throws if contexts out of order
   */
  private calculateStepsWithDuration(trajectory: UserContext[]): StepWithDuration[] {
    const MILLISECONDS_PER_30_DAY_MONTH = 1000 * 60 * 60 * 24 * 30;
    const now = new Date();

    return trajectory.map((ctx, i) => {
      const created = new Date(ctx.createdAt);
      const nextCtx = trajectory[i + 1];
      const next = nextCtx ? new Date(nextCtx.createdAt) : now;

      if (next.getTime() < created.getTime()) {
        throw new Error(
          `Context ${i + 1} createdAt (${nextCtx?.createdAt}) is before ` +
            `Context ${i} createdAt (${ctx.createdAt}). Contexts must be chronologically ordered.`,
        );
      }

      const duration = Math.round((next.getTime() - created.getTime()) / MILLISECONDS_PER_30_DAY_MONTH);
      return { context: ctx, duration };
    });
  }

  /**
   * Compute numerical derivative using central difference method
   *
   * NOTE: Guard clauses guarantee series.length >= 2, so array access is safe
   */
  private derivative(series: number[]): number[] {
    if (series.length === 0) return [];
    if (series.length === 1) return [0];

    return series.map((_, i, arr) => {
      const isFirst = i === 0;
      const isLast = i === arr.length - 1;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (isFirst) return arr[1]! - arr[0]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (isLast) return arr[i]! - arr[i - 1]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (arr[i + 1]! - arr[i - 1]!) / 2;
    });
  }

  /**
   * Compute Jaccard distance between two sets
   * Returns distance [0, 1] where 0 = identical sets, 1 = no overlap
   *
   * Jaccard similarity = |A ∩ B| / |A ∪ B|
   * Jaccard distance = 1 - similarity
   *
   * Edge case: Both sets empty → similarity = 1.0, distance = 0.0
   */
  private computeJaccardDistance(setA: Set<string>, setB: Set<string>): number {
    let intersection = 0;

    setA.forEach((item) => {
      if (setB.has(item)) {
        intersection++;
      }
    });

    const unionSize = setA.size + setB.size - intersection;
    const jaccardSimilarity = unionSize > 0 ? intersection / unionSize : 1;
    return 1 - jaccardSimilarity;
  }

  /**
   * Calculate distance between two trajectory steps
   * Returns normalized distance [0, 1] where 0 = identical, 1 = maximum difference
   *
   * Components (equal weights):
   * - Position: binary 0 or 1
   * - Duration: normalized by MAX(durationA, durationB) (Bug #5 fix: no artificial capping)
   *   - Edge case: both durations = 0 → durationDiff = 0 (no difference)
   *   - Outliers: 120mo vs 1mo → durationDiff ≈ 0.99 (correctly penalized, not capped)
   * - Domains: Jaccard distance (1 - similarity)
   * - Reasons: Jaccard distance (1 - similarity)
   */
  private trajectoryDistance(stepA: UserContext, stepB: UserContext, durationA: number, durationB: number): number {
    // 1. Position difference (0 = same position, 1 = different)
    const positionDiff = stepA.position === stepB.position ? 0 : 1;

    // 2. Duration difference (normalized to 0-1 by max duration)
    // Business logic: Extreme outliers (e.g., 120 months vs 1 month) produce high distance (~0.99)
    // This is CORRECT behavior - outliers should be penalized, not capped (Bug #5 fix)
    const maxDuration = Math.max(durationA, durationB);
    const durationDiff = maxDuration > 0 ? Math.abs(durationA - durationB) / maxDuration : 0; // Both durations zero (identical timestamps) → no difference

    // 3. Domains overlap (Jaccard distance: 1 - similarity)
    const domainsA = new Set(stepA.domains);
    const domainsB = new Set(stepB.domains);
    const domainsDiff = this.computeJaccardDistance(domainsA, domainsB);

    // 4. Reasons overlap (Jaccard distance: 1 - similarity)
    const reasonsA = new Set(stepA.creationReason);
    const reasonsB = new Set(stepB.creationReason);
    const reasonsDiff = this.computeJaccardDistance(reasonsA, reasonsB);

    // Average of four normalized components (equal weights)
    return (positionDiff + durationDiff + domainsDiff + reasonsDiff) / 4;
  }
}
