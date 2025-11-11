import Cypher from '@neo4j/cypher-builder';

/**
 * Применяет OPTIONAL MATCH паттерны к запросу
 * Паттерн из Knex: .modify() для композиции
 */
export function applyOptionalMatches(
  query: Cypher.Match,
  patterns: Cypher.Pattern[]
): Cypher.Match {
  return patterns.reduce((q, p) => q.optionalMatch(p), query);
}
