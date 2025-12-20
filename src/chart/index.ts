import { DEFAULT_FIELDS, extractGrade } from "./config/aspect-configs.js";
import { transformToTrajectories } from "./services/data-transformer.js";
import { calculateAllOverlapSummaries, calculateSimilarity } from "./services/overlap-calculator.js";
import { getR2Config, R2StorageService } from "./services/r2-storage.js";
import { generateChartHtml } from "./templates/chart-html.js";
import { ChartGenerationError } from "./types.js";

import type { ChartableField, GenerateChartInput, GenerateChartOutput, GoalValues, Locale } from "./types.js";
import type { Goal, ScoredMatchedCandidate, UserContext } from "../shared/schemas.js";

export type { ChartableField, GenerateChartInput, GenerateChartOutput, GoalValues } from "./types.js";
export { CHARTABLE_FIELDS } from "./types.js";
export { ASPECT_CONFIGS, DEFAULT_FIELDS, extractGrade } from "./config/aspect-configs.js";

/**
 * Extract goal values for chart visualization from Goal object.
 * Maps targetCriteria fields to chartable field values.
 *
 * @param goal - User's goal with targetCriteria
 * @returns GoalValues for chart horizontal lines
 */
export function extractGoalValues(goal: Goal | null | undefined): GoalValues {
  if (!goal?.targetCriteria) return {};

  const values: GoalValues = {};
  const { targetCriteria } = goal;

  // Position → extract grade
  if (targetCriteria.position?.values[0]) {
    values.position = extractGrade(targetCriteria.position.values[0]);
  }

  // Domains → first domain
  if (targetCriteria.domains?.values[0]) {
    values.domains = targetCriteria.domains.values[0];
  }

  // Note: cityName and industry are not in targetCriteria
  // They would need to be added to Goal schema if needed

  return values;
}

type ChartParams = {
  userTrajectory: UserContext[];
  limitedCandidates: ScoredMatchedCandidate[];
  fields: ChartableField[];
  locale: Locale;
  existingGoal: boolean;
  goalValues: GoalValues;
};

/**
 * Extract and validate chart parameters from input.
 */
function extractChartParams(input: GenerateChartInput): ChartParams {
  const {
    userTrajectory,
    candidates,
    selectedFields,
    maxCandidates = 5,
    locale = "ru",
    existingGoal = false,
    goalValues,
  } = input;

  if (userTrajectory.length === 0) {
    throw new ChartGenerationError("User trajectory is empty", "INVALID_TRAJECTORY");
  }

  return {
    userTrajectory,
    limitedCandidates: candidates.slice(0, maxCandidates),
    fields: selectedFields ?? DEFAULT_FIELDS,
    locale,
    existingGoal,
    goalValues: goalValues ?? {},
  };
}

/**
 * Build chart data and upload to R2.
 */
async function buildAndUploadChart(params: ChartParams): Promise<GenerateChartOutput> {
  const trajectories = transformToTrajectories(
    params.userTrajectory,
    params.limitedCandidates,
    params.locale,
    params.existingGoal,
  );

  const metrics = params.limitedCandidates.map((candidate, index) =>
    calculateSimilarity(trajectories[index + 1]!, candidate),
  );

  // Calculate full overlap summaries for Overlap Timeline
  const userTraj = trajectories[0]!;
  const candidateTrajs = trajectories.slice(1);
  const overlapSummaries = calculateAllOverlapSummaries(userTraj, candidateTrajs, params.fields);

  // Calculate time range for Overlap Timeline alignment
  const allTimestamps = trajectories.flatMap((t) => t.points.map((p) => p.timestamp));
  const timeRange = {
    minTime: Math.min(...allTimestamps),
    maxTime: Math.max(...allTimestamps),
  };

  const chartData = {
    trajectories,
    fields: params.fields,
    selectedFields: params.fields,
    metrics,
    overlapSummaries,
    timeRange,
    locale: params.locale,
    goalValues: params.goalValues ?? {},
  };

  const html = generateChartHtml(chartData);

  const r2Config = getR2Config();
  const storage = new R2StorageService(r2Config);
  const { url, expiresAt } = await storage.upload(html);

  return {
    chartUrl: url,
    expiresAt,
    candidateCount: params.limitedCandidates.length,
    fieldCount: params.fields.length,
  };
}

/**
 * Check if chart service is enabled (R2 configured).
 */
export function isChartServiceEnabled(): boolean {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate interactive HTML chart and upload to R2.
 *
 * @throws {ChartGenerationError} with codes:
 *   - 'CONFIG_MISSING' - R2 not configured
 *   - 'INVALID_TRAJECTORY' - empty trajectories
 *   - 'TRANSFORM_FAILED' - data transformation error
 *   - 'R2_UPLOAD_FAILED' - upload error
 *
 * @example
 * const result = await generateTrajectoryChart({
 *   userTrajectory: state.userTrajectory,
 *   candidates: state.searchResults.slice(0, 5),
 *   locale: 'ru',
 *   existingGoal: !!state.existingGoal,
 * });
 * console.log(result.chartUrl); // https://charts.waymates.com/xxx.html
 */
export async function generateTrajectoryChart(input: GenerateChartInput): Promise<GenerateChartOutput> {
  const params = extractChartParams(input);

  try {
    return await buildAndUploadChart(params);
  } catch (error) {
    if (error instanceof ChartGenerationError) {
      throw error;
    }

    throw new ChartGenerationError(
      `Chart generation failed: ${error instanceof Error ? error.message : String(error)}`,
      "TRANSFORM_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}
