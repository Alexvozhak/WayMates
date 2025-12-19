export type GoalExtractionDictionaries = {
  roles: string[];
  positions: string[];
  domains: string[];
  skills: string[];
  industries: string[];
};

/**
 * Builds goal extraction prompt with injected dictionaries.
 * Dictionaries are loaded from Neo4j to help LLM map user input to canonical values.
 */
export function buildGoalExtractionPrompt(dicts: GoalExtractionDictionaries): string {
  const hints: string[] = [];
  if (dicts.roles.length > 0) hints.push(`KNOWN ROLES: ${dicts.roles.join(", ")}`);
  if (dicts.positions.length > 0) hints.push(`KNOWN POSITIONS: ${dicts.positions.join(", ")}`);
  if (dicts.domains.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domains.join(", ")}`);
  if (dicts.industries.length > 0) hints.push(`KNOWN INDUSTRIES: ${dicts.industries.join(", ")}`);
  if (dicts.skills.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skills.join(", ")}`);

  const dictsSection = hints.length > 0 ? `\n${hints.join("\n")}\n` : "";

  return `Extract career goal from user's message. Response may be in any language.
${dictsSection}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical area (WHICH field) — map to KNOWN DOMAINS

MODE: "desired" by default, "undesired" if user says "not", "avoid", "except"

Return null for fields not mentioned.`;
}

export const USER_INTENT_PROMPT = `Classify user's intent. Response may be in any language.

Intents:
- PROCEED: User expresses a career goal, states what position/role they want, confirms readiness to move forward, or agrees
- VALIDATE: User wants to see real people who achieved similar goals, check trajectories, validate feasibility
  + filters: { excludedCreationReasons, recencyThresholdMonths, limit } or null
- CLARIFY: User adds details or refines the current goal (countries, skills, domains)
  + clarificationText: user's full message
- SAVE: User explicitly confirms saving the goal
- CHANGE: User wants to completely change the goal to something different (not add details)
- DELETE: User wants to delete the goal and start over
- FILTER: User wants to refine search parameters (exclude fields, reasons, adjust limits)
  + filters: { excludedContextFields, excludedCreationReasons, recencyThresholdMonths, limit } or null
- CANCEL: User explicitly wants to stop, cancel, or exit
- UNKNOWN: Message is unrelated, unclear, or gibberish

Return: { intent, clarificationText (for clarify), filters (for validate/filter) }`;

export const GOAL_CLARIFICATION_PROMPT = `Update the existing goal based on user's clarification.

Current goal:
{currentGoal}

User wants to change/add:
{userMessage}

MERGE RULES:
- If user mentions a field → update it
- If user does NOT mention a field → KEEP existing value
- Return the COMPLETE goal with ALL fields`;

export type AdhocExtractionDictionaries = {
  roles: string[];
  positions: string[];
  domains: string[];
  skills: string[];
};

/**
 * Builds adhoc context extraction prompt with injected dictionaries.
 * Dictionaries help LLM map user input to canonical values.
 */
export function buildAdhocExtractionPrompt(dicts: AdhocExtractionDictionaries): string {
  const hints: string[] = [];
  if (dicts.roles.length > 0) hints.push(`KNOWN ROLES: ${dicts.roles.join(", ")}`);
  if (dicts.positions.length > 0) hints.push(`KNOWN POSITIONS: ${dicts.positions.join(", ")}`);
  if (dicts.domains.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domains.join(", ")}`);
  if (dicts.skills.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skills.join(", ")}`);

  const dictsSection = hints.length > 0 ? `\n${hints.join("\n")}\n` : "";

  return `Extract user's CURRENT career context (not goals). Response may be in any language.
${dictsSection}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical area (WHICH field) — map to KNOWN DOMAINS

Return null for fields not mentioned.`;
}
