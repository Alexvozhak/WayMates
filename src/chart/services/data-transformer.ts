import { ASPECT_CONFIGS } from "../config/aspect-configs.js";
import { generateCandidateColors, USER_COLOR } from "../config/colors.js";
import { ChartGenerationError } from "../types.js";

import type { ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type { Locale, ProcessedTrajectory, TrajectoryPoint } from "../types.js";

/**
 * Transform user trajectory to processed format.
 * Extracts values for all chartable fields from each context.
 */
function processUserTrajectory(contexts: UserContext[], locale: Locale): ProcessedTrajectory {
  if (contexts.length === 0) {
    throw new ChartGenerationError("User trajectory is empty", "INVALID_TRAJECTORY");
  }

  const points: TrajectoryPoint[] = contexts.map((ctx) => ({
    timestamp: new Date(ctx.createdAt).getTime(),
    values: Object.fromEntries(Object.values(ASPECT_CONFIGS).map((config) => [config.field, config.extractValue(ctx)])),
  }));

  const label = locale === "ru" ? "Вы" : "You";

  return {
    id: "user",
    label,
    color: USER_COLOR,
    width: 2,
    candidateType: null,
    points,
  };
}

/**
 * Get line width based on candidate type priority.
 */
function getLineWidth(candidateType: "pathfinder" | "waymate" | null): number {
  if (candidateType === "pathfinder") return 3;
  if (candidateType === "waymate") return 2;
  return 1.5;
}

/**
 * Transform candidate to processed format.
 * Handles pathfinder/waymate badges and matched context tracking.
 */
function processCandidateTrajectory(
  candidate: ScoredMatchedCandidate,
  index: number,
  color: string,
  existingGoal: boolean,
): ProcessedTrajectory {
  const { userId, candidateType, matchedContext, timeSinceMatchedMonths, path } = candidate;

  const points: TrajectoryPoint[] = path
    ? path.map((ctx) => ({
        timestamp: new Date(ctx.createdAt).getTime(),
        values: Object.fromEntries(
          Object.values(ASPECT_CONFIGS).map((config) => [config.field, config.extractValue(ctx)]),
        ),
      }))
    : [
        {
          timestamp: new Date(matchedContext.createdAt).getTime(),
          values: Object.fromEntries(
            Object.values(ASPECT_CONFIGS).map((config) => [config.field, config.extractValue(matchedContext)]),
          ),
        },
      ];

  const width = getLineWidth(candidateType);

  const baseTrajectory: ProcessedTrajectory = {
    id: userId,
    label: `#${index + 1}`,
    color,
    width,
    candidateType,
    points,
  };

  if (existingGoal && candidateType === "pathfinder") {
    const foundIndex = path?.findIndex((ctx) => ctx.contextId === matchedContext.contextId) ?? -1;
    if (foundIndex !== -1) {
      baseTrajectory.matchedContextIndex = foundIndex;
    }
    baseTrajectory.timeSinceMatchedMonths = timeSinceMatchedMonths;
  }

  return baseTrajectory;
}

/**
 * Transform raw data to processed trajectories for chart.
 * Generates candidate colors and processes all trajectories.
 */
export function transformToTrajectories(
  userTrajectory: UserContext[],
  candidates: ScoredMatchedCandidate[],
  locale: Locale,
  existingGoal: boolean,
): ProcessedTrajectory[] {
  const userTraj = processUserTrajectory(userTrajectory, locale);
  const colors = generateCandidateColors(candidates.length);

  const candidateTrajs = candidates.map((candidate, index) =>
    processCandidateTrajectory(candidate, index, colors[index]!, existingGoal),
  );

  return [userTraj, ...candidateTrajs];
}
