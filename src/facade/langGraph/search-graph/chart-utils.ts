import { extractGoalValues, generateTrajectoryChart, isChartServiceEnabled } from "../../../chart/index.js";
import { config } from "../../env.js";

import type { GenerateChartInput } from "../../../chart/index.js";
import type {
  AdhocContextBase,
  Goal,
  Locale,
  MatchedCandidateWithPath,
  PathfinderCandidate,
  UserContext,
  WaymateCandidate,
} from "../../../shared/schemas.js";

type Logger = { error: (obj: object, msg: string) => void };
type DictionariesService = { getPositionOrder: () => Promise<string[]> };

/**
 * Convert PathfinderCandidate to chart-compatible WaymateCandidate.
 */
export function pathfinderToChartCandidate(pf: PathfinderCandidate): WaymateCandidate {
  return {
    userId: pf.userId,
    matchedContext: pf.matchedContext,
    contextMatchScore: 0,
    isWaymate: false,
    path: pf.path,
    trails: pf.trails,
    timeSinceMatchedMonths: pf.timeSinceTargetMonths,
    dtwMetrics: pf.dtwMetrics,
    dtwTotal: pf.dtwTotal,
  };
}

/**
 * Convert MatchedCandidateWithPath (reversePathfinders) to chart-compatible WaymateCandidate.
 */
export function matchedToChartCandidate(c: MatchedCandidateWithPath): WaymateCandidate {
  const createdAt = new Date(c.matchedContext.createdAt);
  const monthsSince = Math.floor((Date.now() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
  return {
    userId: c.userId,
    matchedContext: c.matchedContext,
    timeSinceMatchedMonths: monthsSince,
    contextMatchScore: 0,
    isWaymate: false,
    path: c.path,
    trails: c.trails,
  };
}

type BaseChartDeps = {
  userTrajectory: UserContext[];
  adhocContext: AdhocContextBase | null;
  locale: Locale;
  dictionariesService: DictionariesService;
  logger: Logger;
  nodeName: string;
};

type ExploreChartDeps = BaseChartDeps & {
  mode: "explore";
  candidates: WaymateCandidate[];
};

type WithGoalChartDeps = BaseChartDeps & {
  mode: "with-goal";
  candidates: WaymateCandidate[];
  storedGoal: Goal | null;
};

type GoalOnlyChartDeps = BaseChartDeps & {
  mode: "goal-only";
  candidates: WaymateCandidate[];
  storedGoal: Goal | null;
};

export type ChartGenerationDeps = ExploreChartDeps | WithGoalChartDeps | GoalOnlyChartDeps;

function buildChartInput(deps: ChartGenerationDeps, positionOrder: string[]): GenerateChartInput {
  const base = {
    candidates: deps.candidates,
    maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
    positionOrder,
    locale: deps.locale,
  };

  if (deps.mode === "explore") {
    const exploreBase = { ...base, existingGoal: false };
    if (deps.userTrajectory.length > 0) {
      return { mode: "full", userTrajectory: deps.userTrajectory, ...exploreBase };
    }
    return { mode: "candidates-only", adhocContext: deps.adhocContext!, ...exploreBase };
  }

  if (deps.mode === "goal-only") {
    const goalValues = extractGoalValues(deps.storedGoal);
    return { mode: "goal-only", ...base, existingGoal: true, goalValues };
  }

  // mode === "with-goal"
  const goalValues = extractGoalValues(deps.storedGoal);
  const withGoalBase = { ...base, existingGoal: Boolean(deps.storedGoal), goalValues };
  if (deps.userTrajectory.length > 0) {
    return { mode: "full", userTrajectory: deps.userTrajectory, ...withGoalBase };
  }
  return { mode: "candidates-only", adhocContext: deps.adhocContext!, ...withGoalBase };
}

/**
 * Safe chart generation with error handling.
 * Returns null if chart service disabled, no candidates, or generation fails.
 */
export async function safeGenerateChart(deps: ChartGenerationDeps): Promise<string | null> {
  if (!isChartServiceEnabled()) return null;
  if (deps.candidates.length === 0) return null;

  // For non-goal-only modes, need either trajectory or adhoc context
  if (deps.mode !== "goal-only" && deps.userTrajectory.length === 0 && deps.adhocContext === null) return null;

  try {
    const positionOrder = await deps.dictionariesService.getPositionOrder();
    const chartInput = buildChartInput(deps, positionOrder);
    const result = await generateTrajectoryChart(chartInput);
    return result.chartUrl;
  } catch (error) {
    deps.logger.error({ err: error }, `Chart generation failed in ${deps.nodeName}`);
    return null;
  }
}
