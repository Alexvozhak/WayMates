import { ASPECT_CONFIGS } from "../config/aspect-configs.js";
import { generateCandidateColors, USER_COLOR } from "../config/colors.js";

import type { AdhocContextBase, ScoredMatchedCandidate, UserContext } from "../../shared/schemas.js";
import type { Locale, ProcessedTrajectory, TrajectoryPoint } from "../types.js";

type BaseTransformInput = {
  candidates: ScoredMatchedCandidate[];
  locale: Locale;
  existingGoal: boolean;
};

export type FullModeTransformInput = BaseTransformInput & {
  mode: "full";
  userTrajectory: UserContext[];
};

export type CandidatesOnlyTransformInput = BaseTransformInput & {
  mode: "candidates-only";
  adhocContext: AdhocContextBase;
};

export type GoalOnlyTransformInput = BaseTransformInput & {
  mode: "goal-only";
};

export type TransformInput = FullModeTransformInput | CandidatesOnlyTransformInput | GoalOnlyTransformInput;

export function transformFullMode(input: FullModeTransformInput): ProcessedTrajectory[] {
  const colors = generateCandidateColors(input.candidates.length);
  const user = buildUserTrajectory(input.userTrajectory, input.locale);
  const candidates = buildCandidateTrajectories(input.candidates, colors, input.existingGoal);
  return [user, ...candidates];
}

export function transformCandidatesOnly(input: CandidatesOnlyTransformInput): ProcessedTrajectory[] {
  const colors = generateCandidateColors(input.candidates.length);
  const marker = buildAdhocMarker(input.adhocContext, input.locale);
  const candidates = buildCandidateTrajectories(input.candidates, colors, input.existingGoal);
  return [marker, ...candidates];
}

export function transformGoalOnly(input: GoalOnlyTransformInput): ProcessedTrajectory[] {
  const colors = generateCandidateColors(input.candidates.length);
  return buildCandidateTrajectories(input.candidates, colors, input.existingGoal);
}

function buildUserTrajectory(userTrajectory: UserContext[], locale: Locale): ProcessedTrajectory {
  const points = userTrajectory.map((ctx) => extractPointValues(ctx));
  const label = locale === "ru" ? "Вы" : "You";

  return {
    id: "user",
    label,
    color: USER_COLOR,
    width: 2.5,
    isWaymate: false,
    points,
  };
}

function buildAdhocMarker(adhocContext: AdhocContextBase, locale: Locale): ProcessedTrajectory {
  const point = extractAdhocPointValues(adhocContext);
  const label = locale === "ru" ? "Вы" : "You";

  return {
    id: "user",
    label,
    color: USER_COLOR,
    width: 2.5,
    isWaymate: false,
    points: [point],
  };
}

function extractAdhocPointValues(ctx: AdhocContextBase): TrajectoryPoint {
  const values = Object.fromEntries(
    // eslint-disable-next-line complexity -- field mapping for adhoc context
    Object.values(ASPECT_CONFIGS).map((config) => {
      const field = config.field;
      if (field === "position") return [field, ctx.position ?? null];
      if (field === "role") return [field, ctx.role ?? null];
      if (field === "domains") return [field, ctx.domains?.[0] ?? null];
      if (field === "cityName") return [field, ctx.cityName ?? null];
      if (field === "industry") return [field, ctx.industry ?? null];
      if (field === "salaryExact") return [field, null];
      return [field, null];
    }),
  );

  return {
    timestamp: Date.now(),
    values,
  };
}

function buildCandidateTrajectories(
  candidates: ScoredMatchedCandidate[],
  colors: string[],
  existingGoal: boolean,
): ProcessedTrajectory[] {
  return candidates.map((candidate, index) => buildCandidateTrajectory(candidate, colors[index]!, index, existingGoal));
}

function buildCandidateTrajectory(
  candidate: ScoredMatchedCandidate,
  color: string,
  index: number,
  _existingGoal: boolean,
): ProcessedTrajectory {
  const { userId, isWaymate, matchedContext, timeSinceMatchedMonths, path } = candidate;

  const points = extractCandidatePoints(path, matchedContext);

  const trajectory: ProcessedTrajectory = {
    id: userId,
    label: `#${index + 1}`,
    color,
    width: isWaymate ? 2 : 1.5,
    isWaymate,
    points,
  };

  if (timeSinceMatchedMonths !== undefined) {
    trajectory.timeSinceMatchedMonths = timeSinceMatchedMonths;
  }

  return trajectory;
}

function extractCandidatePoints(path: UserContext[] | undefined, matchedContext: UserContext): TrajectoryPoint[] {
  if (path && path.length > 0) {
    return path.map((ctx) => extractPointValues(ctx));
  }
  return [extractPointValues(matchedContext)];
}

function extractPointValues(ctx: UserContext): TrajectoryPoint {
  const values = Object.fromEntries(
    Object.values(ASPECT_CONFIGS).map((config) => [config.field, config.extractValue(ctx)]),
  );

  return {
    timestamp: new Date(ctx.createdAt).getTime(),
    values,
  };
}
