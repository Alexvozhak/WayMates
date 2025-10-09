import type { Driver } from "neo4j-driver";
import type {
  CurrentToTargetResult,
  CurrentToTargetParams,
  SearchPresetOptions,
} from "../schemas-zod.js";
import {
  CurrentToTargetResultSchema,
  DEFAULT_STRICT_SKILL_CATEGORIES,
  getValidatedTypes,
} from "../schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../unified-search-types.js";
import { Processors } from "../cypher/api.js";
import { executeRead, getStrictSkills } from "./helpers.js";
import { PresetsManager } from "../orcestrator/preset-manager.js";
import { QueryOrchestrator } from "../orcestrator/query-orchestrator.js";
import { join } from "path";

/**
 * Выполнение режима current_to_target с использованием динамического оркестратора
 *
 * Поиск переходов от текущего контекста к целевому через двухстадийный процесс:
 * 1. Поиск пользователей с похожими current контекстами (гибкий скоринг)
 * 2. Поиск target контекстов у найденных пользователей (гибкий скоринг)
 * 3. Расчет метрик совместимости и путей обучения
 *
 * @param presetOptions - опции пресетов: {currentPreset, targetPreset}
 *                       Defaults: CURRENT_SEARCH_PRESET, TARGET_SEARCH_PRESET (env vars)
 */
export async function executeCurrentToTarget(
  driver: Driver,
  params: CurrentToTargetParams,
  presetOptions?: SearchPresetOptions
): Promise<CurrentToTargetResult[]> {
  const strictSkills = getStrictSkills(
    params.currentContext.skills,
    DEFAULT_STRICT_SKILL_CATEGORIES
  );

  // Резолвим опции пресетов с отдельными defaults
  const resolvedPresets = presetOptions || {
    currentPreset: process.env.CURRENT_SEARCH_PRESET || "BALANCED",
    targetPreset: process.env.TARGET_SEARCH_PRESET,
  };

  const currentPreset = resolvedPresets.currentPreset;
  const targetPreset = resolvedPresets.targetPreset || currentPreset;

  // Загружаем пресеты и собираем динамические стадии через оркестратор
  const PRESETS_PATH = join(process.cwd(), "config", "presets.json");
  const presetsManager = new PresetsManager(PRESETS_PATH);
  presetsManager.load();

  const orchestrator = new QueryOrchestrator(presetsManager, driver);

  // Генерируем двухэтапный запрос через оркестратор
  const currentStage = await orchestrator.generateCurrentContextQuery(
    currentPreset,
    params.currentContext
  );
  const targetStage = orchestrator.generateTargetContextQuery(targetPreset);

  const cypherQuery = [
    currentStage,
    targetStage,
    Processors.COMPATIBILITY_SCORE,
  ].join("\n\n");

  const cypherParams = {
    currentContext: params.currentContext,
    targetContext: params.targetContext,
    strictSkills,
    searchConstraints: params.searchConstraints || DEFAULT_SEARCH_CONSTRAINTS,
  } as const;

  console.log("🔍 DEBUG: Cypher query:", cypherQuery);
  console.log("🔍 DEBUG: Params:", JSON.stringify(cypherParams, null, 2));
  
  const queryResult = await executeRead(driver, cypherQuery, cypherParams);
  console.log("🔍 DEBUG: Raw results count:", queryResult.records.length);
  
  const validatedResults: CurrentToTargetResult[] = getValidatedTypes(
    queryResult.records,
    CurrentToTargetResultSchema
  );
  console.log("🔍 DEBUG: Validated results count:", validatedResults.length);
  return validatedResults;
}
