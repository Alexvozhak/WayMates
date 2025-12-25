/**
 * Chart Service — Career Trajectory Visualization
 *
 * @see docs/facade/CHART-SERVICE-DESIGN.md — терминология, бизнес-смысл, FAQ
 */

import { ChartBuilder } from "./builders/chart-builder.js";
import { DEFAULT_FIELDS, extractGrade } from "./config/aspect-configs.js";
import { getR2Config, R2StorageService } from "./services/r2-storage.js";
import { ChartGenerationError } from "./types.js";

import type { ChartBuildInput } from "./builders/chart-builder.js";
import type { GenerateChartInput, GenerateChartOutput, GoalValues } from "./types.js";
import type { Goal } from "../shared/schemas.js";

// Re-exports for external consumers
export type { ChartableField, GenerateChartInput, GenerateChartOutput, GoalValues } from "./types.js";
export { CHARTABLE_FIELDS } from "./types.js";
export { ASPECT_CONFIGS, DEFAULT_FIELDS, extractGrade } from "./config/aspect-configs.js";

/**
 * Extract goal values for chart visualization from Goal object.
 * Maps targetContext fields to chartable field values.
 */
export function extractGoalValues(goal: Goal | null | undefined): GoalValues {
  if (!goal?.targetContext) return {};

  const values: GoalValues = {};
  const { targetContext } = goal;

  if (targetContext.position?.values[0]) {
    values.position = extractGrade(targetContext.position.values[0]);
  }

  if (targetContext.domains?.values[0]) {
    values.domains = targetContext.domains.values[0];
  }

  return values;
}

/**
 * Chart generation service facade.
 * Coordinates chart building and R2 upload.
 */
export class ChartService {
  /**
   * Generate chart HTML and upload to R2.
   *
   * @throws {ChartGenerationError} with codes:
   *   - 'CONFIG_MISSING' - R2 not configured
   *   - 'INVALID_TRAJECTORY' - empty trajectories
   *   - 'TRANSFORM_FAILED' - data transformation error
   *   - 'R2_UPLOAD_FAILED' - upload error
   */
  async generateChart(input: GenerateChartInput): Promise<GenerateChartOutput> {
    const buildInput = this.normalizeInput(input);

    try {
      const builder = new ChartBuilder(buildInput);
      const html = builder.build();

      const r2Config = getR2Config();
      const storage = new R2StorageService(r2Config);
      const { url, expiresAt } = await storage.upload(html);

      return {
        chartUrl: url,
        expiresAt,
        candidateCount: buildInput.candidates.length,
        fieldCount: buildInput.fields.length,
      };
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

  private normalizeInput(input: GenerateChartInput): ChartBuildInput {
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
      candidates: candidates.slice(0, maxCandidates),
      fields: selectedFields ?? DEFAULT_FIELDS,
      locale,
      existingGoal,
      goalValues: goalValues ?? {},
    };
  }
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
 * Backwards-compatible function API.
 *
 * @example
 * const result = await generateTrajectoryChart({
 *   userTrajectory: state.userTrajectory,
 *   candidates: state.searchResults.slice(0, 5),
 *   locale: 'ru',
 *   existingGoal: !!state.existingGoal,
 * });
 */
export async function generateTrajectoryChart(input: GenerateChartInput): Promise<GenerateChartOutput> {
  const service = new ChartService();
  return service.generateChart(input);
}
