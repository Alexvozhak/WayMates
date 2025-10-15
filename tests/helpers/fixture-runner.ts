import { Driver } from "neo4j-driver";

import { PresetsManager } from "../../src/orcestrator/preset-manager.js";
import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { SearchManager } from "../../src/search-manager.js";

import {
  CurrentOnlyParamsSchema,
  UserContextSchema,
  TargetContextSchema,
  SearchConstraints,
} from "../../src/schemas-zod.js";

import { loadTestData } from "./test-data-loader.js";
import type { UserKey } from "./user-keys.generated.js";
import type { PresetName } from "./preset-keys.generated.js";
import { PRESETS_PATH } from "../../src/config.js";

// --- internal ----------------------------------------------------------------
function createSearchManager(driver: Driver): SearchManager {
  const presetsManager = new PresetsManager(PRESETS_PATH);
  presetsManager.load();
  const builder = new SearchQueryBuilder(presetsManager);
  return new SearchManager(driver, builder);
}

// --- public helpers ----------------------------------------------------------

export const DEFAULT_CONSTRAINTS: SearchConstraints = {
  max_timing_diff_months: 12,
  timing_diff_threshold_percent: 50,
  max_experience_diff_months: 120,
  results_limit: 20,
};

/**
 * Executes searchCurrentWithBatches scenario.
 */
export async function runCurrentBatches(
  driver: Driver,
  userKey: UserKey,
  preset: PresetName,
  stepSizeMonths = 6,
  numberOfSteps = 2,
  includeFinalBatch = true,
  searchConstraints = DEFAULT_CONSTRAINTS
): Promise<ReturnType<SearchManager["searchCurrentWithBatches"]>> {
  const userData = loadTestData(userKey);
  const currentContext = UserContextSchema.parse(userData.contexts[0]);

  const params = CurrentOnlyParamsSchema.parse({
    currentUserId: userData.user_id,
    currentPreset: preset,
    currentContext,
    stepSizeMonths,
    numberOfSteps,
    includeFinalBatch,
    searchConstraints,
    reasonsToTrack: ["position_changed"], // Default reasons to track
  });
  const manager = createSearchManager(driver);
  return manager.searchCurrentWithBatches(params);
}

/**
 * Executes searchPipeline scenario.
 */
export async function runPipeline(
  driver: Driver,
  userKey: UserKey,
  currentPreset: PresetName,
  targetPreset: PresetName,
  constraints: SearchConstraints
): Promise<ReturnType<SearchManager["searchPipeline"]>> {
  const userData = loadTestData(userKey);
  const currentContext = UserContextSchema.parse(userData.contexts[0]);
  const targetContext = TargetContextSchema.parse(
    userData.contexts[userData.contexts.length - 1]
  );

  const manager = createSearchManager(driver);
  return manager.searchPipeline(
    currentPreset,
    currentContext,
    targetPreset,
    targetContext,
    userData.user_id,
    constraints
  );
}

/**
 * Executes searchCurrent scenario.
 */
export async function runCurrent(
  driver: Driver,
  userKey: UserKey,
  preset: PresetName,
  constraints: SearchConstraints
): Promise<ReturnType<SearchManager["searchCurrent"]>> {
  const userData = loadTestData(userKey);
  const currentContext = UserContextSchema.parse(userData.contexts[0]);

  const manager = createSearchManager(driver);
  return manager.searchCurrent(
    preset,
    currentContext,
    userData.user_id,
    constraints
  );
}
