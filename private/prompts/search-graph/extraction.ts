// ============================================================================
// EXTRACTION PROMPTS
// Extract structured data from user messages (adhoc context, goal)
// ============================================================================

import { ADHOC_FIELD_DESCRIPTIONS, DECOMPOSITION_RULES, GOAL_FIELD_DESCRIPTIONS } from "../shared.js";

// ============================================================================
// EXPORTED FUNCTIONS (public API)
// ============================================================================

/**
 * Builds adhoc context extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildAdhocExtractionPrompt(hints: string): string {
  return `Extract career context from user's professional self-description.

KNOWN VALUES (CAREFULLY check these lists before answering):
{{
${hints}
}}

Fields to extract (use ONLY values from KNOWN lists above):
${ADHOC_FIELDS_SECTION}
${DECOMPOSITION_RULES}
RULES:
1. Extract ONLY from self-descriptions
2. Commands and requests are NOT self-descriptions → return JSON null for ALL fields
3. String fields MUST be either: a) EXACT value from hints, or b) JSON null — NO OTHER STRINGS
4. NEVER return: empty strings "", "null", "NULL", "/null", "0" — use JSON null
5. Number fields: return JSON null if not stated (NOT 0)
6. Array fields: return JSON null if not stated (NOT [])
7. If field not explicitly stated → JSON null
8. domains = TECHNICAL specialization, industry = BUSINESS sector — never mix
9. Do NOT infer position from years of experience
10. countryCode/citizenships: convert country names to ISO alpha-2 codes
11. If citizenships not explicitly stated but country mentioned → use country for BOTH countryCode and citizenships
12. Do NOT infer or expand arrays — extract only what user explicitly stated`;
}

/**
 * Builds adhoc context clarification prompt for incremental updates.
 * LLM merges existing context with new user input.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 * @param currentContext - JSON string of current adhoc context
 * @param userMessage - User's clarification message
 */
export function buildAdhocClarificationPrompt(hints: string, currentContext: string, userMessage: string): string {
  return `Update the existing career context based on user's clarification.

KNOWN VALUES (CAREFULLY check these lists):
{{
${hints}
}}

Current context:
${currentContext}

User adds/changes:
${userMessage}

MERGE RULES (CRITICAL):
1. KEEP all existing non-null values UNLESS user explicitly changes them
2. If user mentions a field → update it (map to KNOWN values from hints)
3. NEVER add fields that user did NOT mention
4. Return the COMPLETE context with ALL fields

Do NOT infer position from years of experience.

Fields (map to KNOWN values from hints):
${ADHOC_FIELDS_SECTION}

NEVER return empty strings "" — use JSON null instead.`;
}

/**
 * Builds goal extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildGoalExtractionPrompt(hints: string): string {
  return `Extract career goal from user's message. Response may be in any language.

KNOWN VALUES (CAREFULLY check these lists):
{{
${hints}
}}

IMPORTANT - distinguish these fields:
${GOAL_FIELDS_SECTION}

MODE: "desired" by default, "undesired" if user says "not", "avoid", "except"

CRITICAL — null handling:
- Field not mentioned → null
- Empty or placeholder values (0, "", []) → null
- Only return actual values explicitly stated by user`;
}

/**
 * Builds goal clarification prompt for merging user input with existing goal.
 * @param currentGoal - JSON string of current goal
 * @param userMessage - User's clarification message
 */
export function buildGoalClarificationPrompt(currentGoal: string, userMessage: string): string {
  return `Update the existing goal based on user's clarification.

Current goal:
${currentGoal}

User wants to change/add:
${userMessage}

MERGE RULES:
- If user mentions a field → update it
- If user does NOT mention a field → KEEP existing value
- Return the COMPLETE goal with ALL fields`;
}

// ============================================================================
// LOCAL CONSTANTS (generated from shared field descriptions)
// ============================================================================

const ADHOC_FIELDS_SECTION = Object.entries(ADHOC_FIELD_DESCRIPTIONS)
  .map(([field, desc]) => `- ${field}: ${desc}`)
  .join("\n");

const GOAL_FIELDS_SECTION = Object.entries(GOAL_FIELD_DESCRIPTIONS)
  .map(([field, desc]) => `- ${field}: ${desc}`)
  .join("\n");
