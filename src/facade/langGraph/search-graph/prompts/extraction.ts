// ============================================================================
// EXTRACTION PROMPTS
// Extract structured data from user messages (adhoc context, goal)
// ============================================================================

import type { AdhocContextBase, TargetContext } from "../../../../shared/schemas.js";

// ============================================================================
// EXPORTED FUNCTIONS (public API)
// ============================================================================

/**
 * Builds adhoc context extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildAdhocExtractionPrompt(hints: string): string {
  return `Extract career context from user's professional self-description.
${hints}
Fields to extract (map to KNOWN values from hints):
${ADHOC_FIELDS_SECTION}

RULES:
1. Extract ONLY from self-descriptions
2. Commands and requests are NOT self-descriptions → return null for ALL fields
3. NEVER return empty strings "" — use JSON null instead
4. NEVER return string representations of null like "null", "/null", "NULL" — use JSON null
5. If field not explicitly stated → null

POSITION: Extract ONLY if user explicitly states their seniority level.
Do NOT infer from years of experience — years ≠ seniority.`;
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
${hints}
Current context:
${currentContext}

User adds/changes:
${userMessage}

MERGE RULES:
- If user mentions a field → update it (map to KNOWN values from hints)
- If user does NOT mention a field → KEEP existing value
- Return the COMPLETE context with ALL fields

POSITION: Extract ONLY if user explicitly states their seniority level.
Do NOT infer from years of experience — years ≠ seniority.

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
${hints}
IMPORTANT - distinguish these fields:
${GOAL_FIELDS_SECTION}

MODE: "desired" by default, "undesired" if user says "not", "avoid", "except"

Return null for fields not mentioned.`;
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
// LOCAL TYPES AND CONSTANTS
// ============================================================================

// Fields we extract from user's professional self-description
// All fields from AdhocContextBase — maximum context capture
// Type-safe: TypeScript enforces all AdhocContextBase keys are present
const ADHOC_FIELD_DESCRIPTIONS: Record<keyof AdhocContextBase, string> = {
  position: "seniority level (junior/middle/senior) — map to KNOWN POSITIONS",
  role: "profession type (WHAT you do) — map to KNOWN ROLES",
  domains: "technical specialization — map to KNOWN DOMAINS",
  skills: "specific technologies or tools — map to KNOWN SKILLS",
  industry: "business sector — map to KNOWN INDUSTRIES",
  companySize: "company size category (startup, SMB, enterprise)",
  cityName: "city where you work",
  countryCode: "work location country — ISO country code",
  citizenships: "passport countries (nationalities) — array of ISO country codes",
  birthYear: "year of birth (for demographics)",
  educationLevel: "highest education level achieved",
  languages: "spoken languages with proficiency — ISO language codes",
};

const ADHOC_FIELDS_SECTION = Object.entries(ADHOC_FIELD_DESCRIPTIONS)
  .map(([field, desc]) => `- ${field}: ${desc}`)
  .join("\n");

// Fields we extract from user's career goal description
// All fields from TargetContext — maximum filtering options
// Type-safe: TypeScript enforces all TargetContext keys are present
const GOAL_FIELD_DESCRIPTIONS: Record<keyof TargetContext, string> = {
  position: "seniority level (HOW experienced) — map to KNOWN POSITIONS",
  role: "profession type (WHAT you do) — map to KNOWN ROLES",
  countries: "target work location (WHERE you want to work) — ISO country codes",
  domains: "technical area (WHICH field) — map to KNOWN DOMAINS",
  skills: "specific technologies or competencies — map to KNOWN SKILLS",
  languages: "spoken languages required for role — ISO language codes",
};

const GOAL_FIELDS_SECTION = Object.entries(GOAL_FIELD_DESCRIPTIONS)
  .map(([field, desc]) => `- ${field}: ${desc}`)
  .join("\n");
