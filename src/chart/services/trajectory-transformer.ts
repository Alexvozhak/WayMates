import { ASPECT_CONFIGS } from "../config/aspect-configs.js";
import { generateCandidateColors, USER_COLOR } from "../config/colors.js";
import { ChartGenerationError } from "../types.js";

import type { ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type { Locale, ProcessedTrajectory, TrajectoryPoint } from "../types.js";

/**
 * Transforms raw user/candidate data into ProcessedTrajectory format for charting.
 * Encapsulates all trajectory building logic with proper data ownership.
 */
export class TrajectoryTransformer {
  private readonly colors: string[];

  constructor(
    private readonly userTrajectory: UserContext[],
    private readonly candidates: ScoredMatchedCandidate[],
    private readonly locale: Locale,
    private readonly existingGoal: boolean,
  ) {
    this.validateInput();
    this.colors = generateCandidateColors(candidates.length);
  }

  /**
   * Transform all data into ProcessedTrajectory array.
   * First element is always user trajectory.
   */
  transform(): ProcessedTrajectory[] {
    const user = this.buildUserTrajectory();
    const candidates = this.buildCandidateTrajectories();
    return [user, ...candidates];
  }

  private validateInput(): void {
    if (this.userTrajectory.length === 0) {
      throw new ChartGenerationError("User trajectory is empty", "INVALID_TRAJECTORY");
    }
  }

  private buildUserTrajectory(): ProcessedTrajectory {
    const points = this.userTrajectory.map((ctx) => this.extractPointValues(ctx));
    const label = this.locale === "ru" ? "Вы" : "You";

    return {
      id: "user",
      label,
      color: USER_COLOR,
      width: 2,
      candidateType: null,
      points,
    };
  }

  private buildCandidateTrajectories(): ProcessedTrajectory[] {
    return this.candidates.map((candidate, index) => this.buildCandidateTrajectory(candidate, index));
  }

  private buildCandidateTrajectory(candidate: ScoredMatchedCandidate, index: number): ProcessedTrajectory {
    const { userId, candidateType, matchedContext, timeSinceMatchedMonths, path } = candidate;
    const color = this.colors[index]!;

    const points = this.extractCandidatePoints(path, matchedContext);
    const width = this.getLineWidth(candidateType);

    const trajectory: ProcessedTrajectory = {
      id: userId,
      label: `#${index + 1}`,
      color,
      width,
      candidateType,
      points,
    };

    this.addGoalMarkerIfNeeded(trajectory, candidate, path);

    if (timeSinceMatchedMonths !== undefined) {
      trajectory.timeSinceMatchedMonths = timeSinceMatchedMonths;
    }

    return trajectory;
  }

  private extractCandidatePoints(path: UserContext[] | undefined, matchedContext: UserContext): TrajectoryPoint[] {
    if (path && path.length > 0) {
      return path.map((ctx) => this.extractPointValues(ctx));
    }
    return [this.extractPointValues(matchedContext)];
  }

  private addGoalMarkerIfNeeded(
    trajectory: ProcessedTrajectory,
    candidate: ScoredMatchedCandidate,
    path: UserContext[] | undefined,
  ): void {
    if (!this.existingGoal) return;
    if (candidate.candidateType !== "pathfinder") return;
    if (!path) return;

    const matchedIndex = path.findIndex((ctx) => ctx.contextId === candidate.matchedContext.contextId);
    if (matchedIndex !== -1) {
      trajectory.matchedContextIndex = matchedIndex;
    }
  }

  private extractPointValues(ctx: UserContext): TrajectoryPoint {
    const values = Object.fromEntries(
      Object.values(ASPECT_CONFIGS).map((config) => [config.field, config.extractValue(ctx)]),
    );

    return {
      timestamp: new Date(ctx.createdAt).getTime(),
      values,
    };
  }

  private getLineWidth(candidateType: "pathfinder" | "waymate" | null): number {
    if (candidateType === "pathfinder") return 3;
    if (candidateType === "waymate") return 2;
    return 1.5;
  }
}
