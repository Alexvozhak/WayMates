import { OverlapCalculator } from "../services/overlap-calculator.js";
import { transformCandidatesOnly, transformFullMode } from "../services/trajectory-transformer.js";

import { HtmlRenderer } from "./html-renderer.js";

import type { AdhocContextBase, ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type {
  ChartableField,
  DynamicLevels,
  GoalValues,
  Locale,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
} from "../types.js";

type BaseBuildInput = {
  candidates: ScoredMatchedCandidate[];
  fields: ChartableField[];
  positionOrder: string[];
  locale: Locale;
  existingGoal: boolean;
  goalValues: GoalValues;
};

type FullModeBuildInput = BaseBuildInput & {
  mode: "full";
  userTrajectory: UserContext[];
};

type CandidatesOnlyBuildInput = BaseBuildInput & {
  mode: "candidates-only";
  adhocContext: AdhocContextBase;
};

export type ChartBuildInput = FullModeBuildInput | CandidatesOnlyBuildInput;

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

  build(): string {
    const renderer = new HtmlRenderer({
      mode: this.input.mode,
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
    if (this.input.mode === "full") {
      return transformFullMode({
        mode: "full",
        userTrajectory: this.input.userTrajectory,
        candidates: this.input.candidates,
        locale: this.input.locale,
        existingGoal: this.input.existingGoal,
      });
    }

    return transformCandidatesOnly({
      mode: "candidates-only",
      adhocContext: this.input.adhocContext,
      candidates: this.input.candidates,
      locale: this.input.locale,
      existingGoal: this.input.existingGoal,
    });
  }

  private calculateMetrics(): { summaries: OverlapSummary[]; metrics: SimilarityMetrics[] } {
    if (this.input.mode === "candidates-only") {
      return { summaries: [], metrics: [] };
    }

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
    if (field === "position") {
      return this.calculatePositionLevels(userTrajectory, candidateTrajectories);
    }

    const orderedLevels: string[] = [];
    const seen = new Set<string>();

    this.addUserValuesToLevels(field, userTrajectory, orderedLevels, seen);
    this.addGoalValueToLevels(field, orderedLevels, seen);
    this.addCandidateValuesToLevels(field, candidateTrajectories, orderedLevels, seen);

    return orderedLevels;
  }

  private calculatePositionLevels(
    userTrajectory: ProcessedTrajectory,
    candidateTrajectories: ProcessedTrajectory[],
  ): string[] {
    const allValues = new Set<string>();

    for (const p of userTrajectory.points) {
      const v = p.values.position;
      if (this.isValidStringValue(v)) allValues.add(v);
    }

    const goalValue = this.input.goalValues.position;
    if (this.isValidStringValue(goalValue)) allValues.add(goalValue);

    for (const p of candidateTrajectories.flatMap((t) => t.points)) {
      const v = p.values.position;
      if (this.isValidStringValue(v)) allValues.add(v);
    }

    const orderMap = new Map(this.input.positionOrder.map((v, i) => [v, i]));
    return [...allValues].toSorted((a, b) => (orderMap.get(a) ?? Infinity) - (orderMap.get(b) ?? Infinity));
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
