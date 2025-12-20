import type { DictionariesCache } from "../../services/dictionaries-cache.js";

/**
 * Shared dictionaries type for LLM extraction prompts.
 * Loaded from Neo4j via DictionariesCache.
 */
export type ExtractionDictionaries = {
  roles: string[];
  positions: string[];
  domains: string[];
  skills: string[];
};

/**
 * Loads extraction dictionaries from cache.
 * Used by cold-start, search-graph, and other extraction nodes.
 */
export async function loadExtractionDicts(cache: DictionariesCache): Promise<ExtractionDictionaries> {
  const [roles, positions, domains, skills] = await Promise.all([
    cache.getSimple("role"),
    cache.getSimple("position"),
    cache.getSimple("domain"),
    cache.getSimple("skill"),
  ]);

  return {
    roles: [...roles.values()],
    positions: [...positions.values()],
    domains: [...domains.values()],
    skills: [...skills.values()],
  };
}

/**
 * Builds KNOWN_* hints section for extraction prompts.
 * Helps LLM map user terms to canonical values.
 *
 * @param dicts - Dictionaries from DictionariesCache
 * @param maxSkills - Limit skills count to avoid prompt bloat (default: 50)
 */
export function buildDictionaryHints(dicts: ExtractionDictionaries, maxSkills = 50): string {
  const hints: string[] = [];

  if (dicts.roles.length > 0) hints.push(`KNOWN ROLES: ${dicts.roles.join(", ")}`);
  if (dicts.positions.length > 0) hints.push(`KNOWN POSITIONS: ${dicts.positions.join(", ")}`);
  if (dicts.domains.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domains.join(", ")}`);
  if (dicts.skills.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skills.slice(0, maxSkills).join(", ")}`);

  return hints.length > 0 ? `\n${hints.join("\n")}\n` : "";
}
