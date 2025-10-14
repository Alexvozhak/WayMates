import { Driver } from "neo4j-driver";
import { join } from "path";

import { PresetsManager } from "../../src/orcestrator/preset-manager.js";
import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { SearchManager } from "../../src/search-manager.js";

import { clearDb, seedUsers } from "./neo4j-test-utils.js";
import {
  CurrentOnlyParamsSchema,
  UserContextSchema,
  TargetContextSchema,
  SearchConstraints,
} from "../../src/schemas-zod.js";

import { loadTestData } from "./test-data-loader.js";
import type { UserKey } from "./user-keys.generated.js";
import type { PresetName } from "./preset-keys.generated.js";

// --- internal ----------------------------------------------------------------
function createSearchManager(driver: Driver): SearchManager {
  const configPath = join(process.cwd(), "config", "presets.json");
  const presetsManager = new PresetsManager(configPath);
  presetsManager.load();
  const builder = new SearchQueryBuilder(presetsManager);
  return new SearchManager(driver, builder);
}

async function prepareDb(driver: Driver, userKeys: string[]): Promise<void> {
  await clearDb(driver);
  await seedUsers(driver, userKeys);
}

// --- public helpers ----------------------------------------------------------

const DEFAULT_CONSTRAINTS: SearchConstraints = {
  max_timing_diff_months: 12,
  timing_diff_threshold_percent: 50,
  max_experience_diff_months: 120,
  results_limit: 50,
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
  await prepareDb(driver, [userKey]);

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
) {
  await prepareDb(driver, [userKey]);

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
) {
  await prepareDb(driver, [userKey]);

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
