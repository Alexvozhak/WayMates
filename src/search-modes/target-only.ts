import type { Driver } from "neo4j-driver";
import type { TargetAnalysisResult, TargetOnlyParams } from "../schemas-zod.js";
import { TargetAnalysisResultSchema, validateSchema } from "../schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../unified-search-types.js";
import { SearchQueries } from "../cypher/api.js";
import { executeRead } from "./helpers.js";

/**
 * Выполнение режима target_only
 * Анализ карьерных путей к целевой роли
 */
export async function executeTargetOnly(
  driver: Driver,
  params: TargetOnlyParams
): Promise<TargetAnalysisResult> {
  const cypherQuery = SearchQueries.TARGET_ONLY;

  const cypherParams = {
    targetContext: params.targetContext,
    searchConstraints: params.searchConstraints || DEFAULT_SEARCH_CONSTRAINTS,
  } as const;

  const queryResult = await executeRead(driver, cypherQuery, cypherParams);

  // Для TARGET_ONLY возвращаем один агрегированный результат
  if (queryResult.records.length === 0) {
    throw new Error("No target contexts found");
  }

  const result = queryResult.records[0]!.get("result");
  const validatedResult = validateSchema(result, TargetAnalysisResultSchema);
  return validatedResult;
}
