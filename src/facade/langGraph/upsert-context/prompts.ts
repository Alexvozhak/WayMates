import type { ExtractionDictionaries } from "../../services/dictionaries-cache.js";

/**
 * Builds context extraction prompt with injected dictionaries.
 * Dictionaries are loaded from Neo4j to help LLM map user input to canonical values.
 */
export function buildContextExtractionPrompt(dicts: ExtractionDictionaries): string {
  const hints: string[] = [];
  if (dicts.role.length > 0) hints.push(`KNOWN ROLES: ${dicts.role.join(", ")}`);
  if (dicts.position.length > 0) hints.push(`KNOWN POSITIONS: ${dicts.position.join(", ")}`);
  if (dicts.domain.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domain.join(", ")}`);
  if (dicts.industry.length > 0) hints.push(`KNOWN INDUSTRIES: ${dicts.industry.join(", ")}`);
  if (dicts.skill.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skill.join(", ")}`);

  const dictsSection = hints.length > 0 ? `\n${hints.join("\n")}\n` : "";

  return `Extract career context from user's natural language description.
${dictsSection}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical area (WHICH field) — map to KNOWN DOMAINS

Return null for fields not mentioned.`;
}

export const CONTEXT_EDIT_PROMPT = `Apply corrections to career context.

Apply user's requested changes to the current context data.
Preserve all unchanged fields, including contextId.

Return the complete updated context JSON.`;
