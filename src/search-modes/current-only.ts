import type { Driver } from "neo4j-driver";
import type {
  AvatarResearchResult,
  CurrentOnlyParams,
} from "../schemas-zod.js";
import {
  AvatarResearchResultSchema,
  DEFAULT_STRICT_SKILL_CATEGORIES,
  getValidatedTypes,
} from "../schemas-zod.js";
import {
  DEFAULT_SEARCH_CONSTRAINTS,
  DEFAULT_REASONS_TO_TRACK,
} from "../unified-search-types.js";
import { SearchQueries } from "../cypher/api.js";
import { executeRead, getStrictSkills } from "./helpers.js";

/**
 * Выполнение режима current_only
 * Анализ развития текущего контекста через время
 */
export async function executeCurrentOnly(
  driver: Driver,
  params: CurrentOnlyParams
): Promise<AvatarResearchResult[]> {
  const strictSkills = getStrictSkills(
    params.currentContext.skills,
    DEFAULT_STRICT_SKILL_CATEGORIES
  );

  const cypherQuery = SearchQueries.CURRENT_ONLY;

  const cypherParams = {
    currentContext: params.currentContext,
    strictSkills,
    timePeriod: params.lookAheadMonths,
    reasonsToTrack: params.reasonsToTrack || DEFAULT_REASONS_TO_TRACK,
    searchConstraints: params.searchConstraints || DEFAULT_SEARCH_CONSTRAINTS,
  } as const;

  const queryResult = await executeRead(driver, cypherQuery, cypherParams);
  const validatedResults: AvatarResearchResult[] = getValidatedTypes(
    queryResult.records,
    AvatarResearchResultSchema
  );
  return validatedResults;
}
