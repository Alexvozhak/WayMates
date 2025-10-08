// Unified Cypher domain - single entry point
import { Finders, Processors } from "../../generated/queries.generated.js";

/**
 * Прямой экспорт всех доменных групп для удобства
 */
export { Upserts, Finders, Processors } from "../../generated/queries.generated.js";

/**
 * Предопределенные композиции для search-modes (семантические)
 *
 * Примечание: CURRENT_TO_TARGET теперь использует динамический оркестратор
 * вместо статичной композиции и не включен в этот объект.
 */
export const SearchQueries = {
  CURRENT_ONLY: [Finders.SIMILAR_CONTEXTS, Processors.CAREER_PROGRESSION].join(
    "\n\n"
  ),

  TARGET_ONLY: [Finders.TARGET_ACHIEVERS, Processors.ACHIEVEMENT_PATHS].join(
    "\n\n"
  ),

  TARGET_SEARCH: [Finders.TARGET_ACHIEVERS, Processors.SEARCH_RESULTS].join(
    "\n\n"
  ),
} as const;
