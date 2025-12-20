import { OverlapCalculator } from "../services/overlap-calculator.js";
import { TrajectoryTransformer } from "../services/trajectory-transformer.js";

import { HtmlRenderer } from "./html-renderer.js";

import type { ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type {
  ChartableField,
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

  constructor(private readonly input: ChartBuildInput) {
    this.trajectories = this.transformTrajectories();
    const { summaries, metrics } = this.calculateMetrics();
    this.overlapSummaries = summaries;
    this.metrics = metrics;
    this.timeRange = this.calculateTimeRange();
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
}
