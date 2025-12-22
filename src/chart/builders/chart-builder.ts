import { OverlapCalculator } from "../services/overlap-calculator.js";
import { TrajectoryTransformer } from "../services/trajectory-transformer.js";

import { HtmlRenderer } from "./html-renderer.js";

import type { ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type {
  ChartableField,
  DynamicLevels,
  GoalValues,
  Locale,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
} from "../types.js";

export type ChartBuildInput = {
  userTrajectory: UserContext[];
  candidates: ScoredMatchedCandidate[];
  fields: ChartableField[];
  locale: Locale;
  existingGoal: boolean;
  goalValues: GoalValues;
};

type TimeRange = { minTime: number; maxTime: number };

/**
 * Orchestrates chart building by coordinating transformer, calculator, and renderer.
 * Single entry point for HTML chart generation.
 */
export class ChartBuilder {
  private readonly trajectories: ProcessedTrajectory[];
  private readonly overlapSummaries: OverlapSummary[];
  private readonly metrics: SimilarityMetrics[];
  private readonly timeRange: TimeRange;
  private readonly dynamicLevels: DynamicLevels;

  constructor(private readonly input: ChartBuildInput) {
    this.trajectories = this.transformTrajectories();
    const { summaries, metrics } = this.calculateMetrics();
    this.overlapSummaries = summaries;
    this.metrics = metrics;
    this.timeRange = this.calculateTimeRange();
    this.dynamicLevels = this.calculateDynamicLevels();
  }

  /**
   * Build complete HTML chart document.
   */
  build(): string {
    const renderer = new HtmlRenderer({
      trajectories: this.trajectories,
      fields: this.input.fields,
      metrics: this.metrics,
      overlapSummaries: this.overlapSummaries,
      timeRange: this.timeRange,
      locale: this.input.locale,
      goalValues: this.input.goalValues,
      dynamicLevels: this.dynamicLevels,
    });

    return renderer.render();
  }

  private transformTrajectories(): ProcessedTrajectory[] {
    const transformer = new TrajectoryTransformer(
      this.input.userTrajectory,
      this.input.candidates,
      this.input.locale,
      this.input.existingGoal,
    );

    return transformer.transform();
  }

  private calculateMetrics(): { summaries: OverlapSummary[]; metrics: SimilarityMetrics[] } {
    const userTrajectory = this.trajectories[0]!;
    const candidateTrajectories = this.trajectories.slice(1);

    const calculator = new OverlapCalculator(userTrajectory, candidateTrajectories, this.input.fields);

    return {
      summaries: calculator.calculateOverlapSummaries(),
      metrics: calculator.calculateSimilarityMetrics(this.input.candidates),
    };
  }

  private calculateTimeRange(): TimeRange {
    const allTimestamps = this.trajectories.flatMap((t) => t.points.map((p) => p.timestamp));

    return {
      minTime: Math.min(...allTimestamps),
      maxTime: Math.max(...allTimestamps),
    };
  }

  /**
   * Calculate dynamic levels for Y-axis with chronological ordering.
   * Order: User values (chronologically) → Goal value → Candidate values (alphabetically)
   * This ensures User trajectory goes upward on the chart.
   */
  private calculateDynamicLevels(): DynamicLevels {
    const levels: DynamicLevels = {};
    const userTrajectory = this.trajectories[0]!;
    const candidateTrajectories = this.trajectories.slice(1);

    for (const field of this.input.fields) {
      levels[field] = this.calculateLevelsForField(field, userTrajectory, candidateTrajectories);
    }

    return levels;
  }

  private calculateLevelsForField(
    field: ChartableField,
    userTrajectory: ProcessedTrajectory,
    candidateTrajectories: ProcessedTrajectory[],
  ): string[] {
    const orderedLevels: string[] = [];
    const seen = new Set<string>();

    // 1. User values in chronological order (trajectory already sorted by timestamp)
    this.addUserValuesToLevels(field, userTrajectory, orderedLevels, seen);

    // 2. Goal value (if not already in User trajectory)
    this.addGoalValueToLevels(field, orderedLevels, seen);

    // 3. Remaining candidate values (alphabetically for predictability)
    this.addCandidateValuesToLevels(field, candidateTrajectories, orderedLevels, seen);

    return orderedLevels;
  }

  private addUserValuesToLevels(
    field: ChartableField,
    userTrajectory: ProcessedTrajectory,
    orderedLevels: string[],
    seen: Set<string>,
  ): void {
    for (const point of userTrajectory.points) {
      const value = point.values[field];
      if (this.isValidStringValue(value) && !seen.has(value)) {
        orderedLevels.push(value);
        seen.add(value);
      }
    }
  }

  private addGoalValueToLevels(field: ChartableField, orderedLevels: string[], seen: Set<string>): void {
    const goalValue = this.input.goalValues[field];
    if (this.isValidStringValue(goalValue) && !seen.has(goalValue)) {
      orderedLevels.push(goalValue);
      seen.add(goalValue);
    }
  }

  /* eslint-disable max-depth -- collecting values from nested candidate trajectories */
  private addCandidateValuesToLevels(
    field: ChartableField,
    candidateTrajectories: ProcessedTrajectory[],
    orderedLevels: string[],
    seen: Set<string>,
  ): void {
    const candidateValues = new Set<string>();

    for (const traj of candidateTrajectories) {
      for (const point of traj.points) {
        const value = point.values[field];
        if (this.isValidStringValue(value) && !seen.has(value)) {
          candidateValues.add(value);
        }
      }
    }

    orderedLevels.push(...[...candidateValues].toSorted());
  }
  /* eslint-enable max-depth */

  private isValidStringValue(value: unknown): value is string {
    return value !== null && value !== undefined && typeof value === "string";
  }
}
