import type { Driver } from "neo4j-driver";
import type { AvatarSearchResult, TargetSearchParams } from "../schemas-zod.js";
import { AvatarSearchResultSchema, getValidatedTypes } from "../schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../unified-search-types.js";
import { SearchQueries } from "../cypher/api.js";
import { executeRead } from "./helpers.js";

/**
 * Выполнение режима target_search
 * Поиск пользователей по целевому контексту
 */
export async function executeTargetSearch(
  driver: Driver,
  params: TargetSearchParams
): Promise<AvatarSearchResult[]> {
  const cypherQuery = SearchQueries.TARGET_SEARCH;

  const cypherParams = {
    targetContext: params.targetContext,
    searchConstraints: params.searchConstraints || DEFAULT_SEARCH_CONSTRAINTS,
  } as const;

  const result = await executeRead(driver, cypherQuery, cypherParams);
  return getValidatedTypes(result.records, AvatarSearchResultSchema);
}
