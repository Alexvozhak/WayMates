import type { DictionaryEntry } from "../../../shared/schemas.js";
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
  industries: string[];
  reasons: DictionaryEntry[];
};

/**
 * Loads extraction dictionaries from cache.
 * Used by cold-start, search-graph, and other extraction nodes.
 */
export async function loadExtractionDicts(cache: DictionariesCache): Promise<ExtractionDictionaries> {
  const [roles, positions, domains, skills, industries, reasons] = await Promise.all([
    cache.getSimple("role"),
    cache.getSimple("position"),
    cache.getSimple("domain"),
    cache.getSimple("skill"),
    cache.getSimple("industry"),
    cache.getReasons(),
  ]);

  return {
    roles: [...roles.values()].map((e) => e.canonicalName),
    positions: [...positions.values()].map((e) => e.canonicalName),
    domains: [...domains.values()].map((e) => e.canonicalName),
    skills: [...skills.values()].map((e) => e.canonicalName),
    industries: [...industries.values()].map((e) => e.canonicalName),
    reasons,
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
  const simpleHints: [string, string[]][] = [
    ["ROLES", dicts.roles],
    ["POSITIONS", dicts.positions],
    ["DOMAINS", dicts.domains],
    ["INDUSTRIES", dicts.industries],
    ["SKILLS", dicts.skills.slice(0, maxSkills)],
  ];

  const hints = simpleHints
    .filter(([, values]) => values.length > 0)
    .map(([label, values]) => `KNOWN ${label}: ${values.join(", ")}`);

  if (dicts.reasons.length > 0) {
    const reasonsWithDesc = dicts.reasons.map((r) => `${r.canonicalName} (${r.description})`).join(", ");
    hints.push(`KNOWN REASONS: ${reasonsWithDesc}`);
  }

  return hints.length > 0 ? `\n${hints.join("\n")}\n` : "";
}
