import { CHARTABLE_FIELDS, extractGoalValues, generateTrajectoryChart, toChartLocale } from "../../../chart/index.js";
import { config } from "../../env.js";

import type { CandidateType, ChartableField, ChartCandidate, GenerateChartInput } from "../../../chart/index.js";
import type {
  AdhocContextBase,
  Goal,
  Locale,
  MatchedCandidateWithPath,
  PathfinderCandidate,
  UserContext,
  WaymateCandidate,
} from "../../../shared/schemas.js";

/** Approximate milliseconds in a month (30 days) for timeSinceMatchedMonths calculation */
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

type Logger = { error: (obj: object, msg: string) => void };
type DictionariesService = { getPositionOrder: () => Promise<string[]> };

/** Convert WaymateCandidate to ChartCandidate */
export function waymateToChart(c: WaymateCandidate): ChartCandidate {
  const chart: ChartCandidate = {
    userId: c.userId,
    matchedContext: c.matchedContext,
    candidateType: "waymate",
  };
  if (c.path) chart.path = c.path;
  if (c.trails) chart.trails = c.trails;
  if (c.timeSinceMatchedMonths !== undefined) chart.timeSinceMatchedMonths = c.timeSinceMatchedMonths;
  if (c.dtwMetrics) chart.dtwMetrics = c.dtwMetrics;
  if (c.dtwTotal !== undefined) chart.dtwTotal = c.dtwTotal;
  return chart;
}

/** Convert WaymateCandidate to ChartCandidate for explore (neutral type) */
export function exploreToChart(c: WaymateCandidate): ChartCandidate {
  const chart: ChartCandidate = {
    userId: c.userId,
    matchedContext: c.matchedContext,
    candidateType: "similar",
  };
  if (c.path) chart.path = c.path;
  if (c.trails) chart.trails = c.trails;
  if (c.timeSinceMatchedMonths !== undefined) chart.timeSinceMatchedMonths = c.timeSinceMatchedMonths;
  if (c.dtwMetrics) chart.dtwMetrics = c.dtwMetrics;
  if (c.dtwTotal !== undefined) chart.dtwTotal = c.dtwTotal;
  return chart;
}

/** Convert PathfinderCandidate to ChartCandidate */
export function pathfinderToChart(pf: PathfinderCandidate): ChartCandidate {
  const chart: ChartCandidate = {
    userId: pf.userId,
    matchedContext: pf.matchedContext,
    candidateType: "pathfinder",
  };
  if (pf.path) chart.path = pf.path;
  if (pf.trails) chart.trails = pf.trails;
  if (pf.timeSinceTargetMonths !== undefined) chart.timeSinceMatchedMonths = pf.timeSinceTargetMonths;
  if (pf.dtwMetrics) chart.dtwMetrics = pf.dtwMetrics;
  if (pf.dtwTotal !== undefined) chart.dtwTotal = pf.dtwTotal;
  return chart;
}

/** Convert MatchedCandidateWithPath to ChartCandidate */
export function matchedToChart(c: MatchedCandidateWithPath, candidateType: CandidateType): ChartCandidate {
  const createdAt = new Date(c.matchedContext.createdAt);
  const monthsSince = Math.floor((Date.now() - createdAt.getTime()) / MS_PER_MONTH);
  const chart: ChartCandidate = {
    userId: c.userId,
    matchedContext: c.matchedContext,
    timeSinceMatchedMonths: monthsSince,
    candidateType,
  };
  if (c.path) chart.path = c.path;
  if (c.trails) chart.trails = c.trails;
  return chart;
}

type BaseChartDeps = {
  userTrajectory: UserContext[];
  adhocContext: AdhocContextBase | null;
  candidates: ChartCandidate[];
  locale: Locale;
  dictionariesService: DictionariesService;
  logger: Logger;
  nodeName: string;
  excludedContextFields: string[];
};

export type ChartGenerationDeps = BaseChartDeps &
  ({ mode: "explore" } | { mode: "with-goal" | "goal-only"; storedGoal: Goal | null });

function toChartableFields(fields: string[]): ChartableField[] {
  const chartableSet = new Set<string>(CHARTABLE_FIELDS);
  return fields.filter((f): f is ChartableField => chartableSet.has(f));
}

function buildChartInput(deps: ChartGenerationDeps, positionOrder: string[]): GenerateChartInput {
  const excludedOverlapFields = toChartableFields(deps.excludedContextFields);
  const base = {
    candidates: deps.candidates,
    maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
    positionOrder,
    locale: toChartLocale(deps.locale),
    excludedOverlapFields,
  };

  if (deps.mode === "explore") {
    if (deps.userTrajectory.length > 0) {
      return { mode: "full", userTrajectory: deps.userTrajectory, ...base };
    }
    return { mode: "candidates-only", adhocContext: deps.adhocContext!, ...base };
  }

  if (deps.mode === "goal-only") {
    const goalValues = extractGoalValues(deps.storedGoal);
    return { mode: "goal-only", ...base, goalValues };
  }

  // mode === "with-goal"
  const goalValues = extractGoalValues(deps.storedGoal);
  if (deps.userTrajectory.length > 0) {
    return { mode: "full", userTrajectory: deps.userTrajectory, ...base, goalValues };
  }
  return { mode: "candidates-only", adhocContext: deps.adhocContext!, ...base, goalValues };
}

/**
 * Safe chart generation with error handling.
 * Returns null if no candidates or generation fails.
 */
export async function safeGenerateChart(deps: ChartGenerationDeps): Promise<string | null> {
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
