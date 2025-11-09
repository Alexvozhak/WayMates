import DynamicTimeWarping from "dynamic-time-warping-ts";
import type { UserContext, DTWMetrics } from "../shared/schemas.js";

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
   * - Durations calculated once (not 6 times)
   * - StepWithDuration wrappers created once (not 4 times)
   * - DTW computed once for Shape+Stability (not twice)
   */
  computeDTWMetrics(
    userTrajectory: UserContext[],
    candidateTrajectory: UserContext[],
    durationCapMonths: number = 36
  ): DTWMetrics {
    // 1. Calculate durations once (used by all 3 metrics)
    const userDurations = this.calculateDurationMonths(userTrajectory);
    const candidateDurations = this.calculateDurationMonths(candidateTrajectory);

    // 2. Create StepWithDuration wrappers once (for Shape + Stability)
    const userSteps: StepWithDuration[] = userTrajectory.map((ctx, i) => ({
      context: ctx,
      duration: userDurations[i]!,
    }));
    const candidateSteps: StepWithDuration[] = candidateTrajectory.map((ctx, i) => ({
      context: ctx,
      duration: candidateDurations[i]!,
    }));

    // 3. Compute DTW once (for Shape + Stability metrics)
    const dtw = new DynamicTimeWarping(
      userSteps,
      candidateSteps,
      (a: StepWithDuration, b: StepWithDuration) =>
        this.trajectoryDistance(
          a.context,
          b.context,
          a.duration,
          b.duration,
          durationCapMonths
        )
    );

    const distance = dtw.getDistance();
    const pathLength = dtw.getPath().length;

    this.validatePathLength(
      pathLength,
      userTrajectory.length,
      candidateTrajectory.length
    );

    // 4. Compute Shape and Stability from cached DTW result
    const shapeSimilarity = 1 / (1 + distance / pathLength);
    const stabilityScore =
      Math.min(userTrajectory.length, candidateTrajectory.length) / pathLength;

    // 5. Compute Tempo (separate DTW on derivatives)
    const tempoSimilarity = this.computeTempoSimilarity(
      userDurations,
      candidateDurations,
      userTrajectory.length,
      candidateTrajectory.length
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
    candidateTrajectoryLength: number
  ): number {
    const userDeriv = this.derivative(userDurations);
    const candidateDeriv = this.derivative(candidateDurations);

    const dtw = new DynamicTimeWarping(
      userDeriv,
      candidateDeriv,
      (a: number, b: number) => Math.abs(a - b)
    );

    const distance = dtw.getDistance();
    const pathLength = dtw.getPath().length;

    this.validatePathLength(
      pathLength,
      userTrajectoryLength,
      candidateTrajectoryLength
    );

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
    candidateTrajectoryLength: number
  ): void {
    if (pathLength === 0) {
      throw new Error(
        `DTW path length is zero (library bug). ` +
          `User trajectory: ${userTrajectoryLength} steps, ` +
          `Candidate trajectory: ${candidateTrajectoryLength} steps.`
      );
    }
  }

  /**
   * Calculate duration in months for each context
   * Last context duration = from createdAt to Date.now()
   *
   * NOTE: Uses 30-day month approximation for simplicity.
   * Sufficient precision for DTW metrics (relative comparison).
   */
  private calculateDurationMonths(trajectory: UserContext[]): number[] {
    const MILLISECONDS_PER_30_DAY_MONTH = 1000 * 60 * 60 * 24 * 30;
    const now = new Date();

    return trajectory.map((ctx, i) => {
      const created = new Date(ctx.createdAt);
      const next = trajectory[i + 1]
        ? new Date(trajectory[i + 1].createdAt)
        : now;
      return Math.round(
        (next.getTime() - created.getTime()) / MILLISECONDS_PER_30_DAY_MONTH
      );
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

      if (isFirst) return arr[1]! - arr[0]!;
      if (isLast) return arr[i]! - arr[i - 1]!;
      return (arr[i + 1]! - arr[i - 1]!) / 2;
    });
  }

  /**
   * Calculate distance between two trajectory steps
   * Returns normalized distance [0, 1] where 0 = identical, 1 = maximum difference
   *
   * Components (equal weights):
   * - Position: binary 0 or 1
   * - Duration: |diff| / durationCapMonths, capped at 1.0
   * - Reasons: Jaccard distance (1 - similarity)
   */
  private trajectoryDistance(
    stepA: UserContext,
    stepB: UserContext,
    durationA: number,
    durationB: number,
    durationCapMonths: number
  ): number {
    // 1. Position difference (0 = same position, 1 = different)
    const positionDiff = stepA.position === stepB.position ? 0 : 1;

    // 2. Duration difference (normalized to 0-1, capped at durationCapMonths)
    const durationDiff = Math.min(
      Math.abs(durationA - durationB) / durationCapMonths,
      1
    );

    // 3. Reasons overlap (Jaccard distance: 1 - similarity)
    const reasonsA = new Set(stepA.creationReason);
    const reasonsB = new Set(stepB.creationReason);

    let intersection = 0;
    reasonsA.forEach((reason) => {
      if (reasonsB.has(reason)) {
        intersection++;
      }
    });

    const unionSize = reasonsA.size + reasonsB.size - intersection;
    const jaccardSimilarity = unionSize > 0 ? intersection / unionSize : 1.0;
    const reasonsDiff = 1 - jaccardSimilarity;

    // Average of three normalized components (equal weights)
    return (positionDiff + durationDiff + reasonsDiff) / 3;
  }
}
