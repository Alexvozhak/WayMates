import { buildDictionaryHints } from "../shared/dictionary-hints.js";

import type { ExtractionDictionaries } from "../shared/dictionary-hints.js";

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
- ASK: User asks a QUESTION about search results, candidates, their trajectories, skills, or chart
  + question: user's question text
- CANCEL: User explicitly wants to stop, cancel, or exit
- UNKNOWN: Message is unrelated, unclear, or gibberish

Return: { intent, clarificationText (for clarify), filters (for validate/filter), question (for ask) }`;

export const GOAL_CLARIFICATION_PROMPT = `Update the existing goal based on user's clarification.

Current goal:
{currentGoal}

User wants to change/add:
{userMessage}

MERGE RULES:
- If user mentions a field → update it
- If user does NOT mention a field → KEEP existing value
- Return the COMPLETE goal with ALL fields`;

/**
 * Builds adhoc context extraction prompt with injected dictionaries.
 * Dictionaries help LLM map user input to canonical values.
 */
export function buildAdhocExtractionPrompt(dicts: ExtractionDictionaries): string {
  const dictsSection = buildDictionaryHints(dicts);

  return `Extract user's CURRENT career context (not goals). Response may be in any language.
${dictsSection}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical area (WHICH field) — map to KNOWN DOMAINS

Return null for fields not mentioned.`;
}

/**
 * Career Advisor system prompt for Q&A about search results.
 * Includes DTW explanation, terminology, and evidence-based response rules.
 */
export const ADVISOR_SYSTEM_PROMPT = `You are a caring career advisor and navigator. Help users understand their career options based on REAL DATA from search results.

TERMINOLOGY:
- Pathfinder: candidate who REACHED the user's goal (candidateType: "pathfinder")
- Waymate: candidate with the SAME goal as user (candidateType: "waymate")
- Trajectory/Path: sequence of career contexts from first job to current
- Trail: learning activity between contexts (courses, certifications)
- Context: single career position with skills, role, domain, etc.

DTW METRICS (Dynamic Time Warping — trajectory comparison):
Each metric is 0-1 where 1 = perfectly similar.

1. Shape Similarity — how similar the career steps are
   Formula: 1 / (1 + dtw_distance / path_length)
   High (~0.9): Both followed Junior → Middle → Senior path
   Low (~0.4): Very different career progressions

2. Tempo Similarity — how similar the career speeds are
   Formula: 1 / (1 + derivative_distance / path_length)
   High (~0.85): Both spent ~2 years per level
   Low (~0.4): One grew fast, other slow

3. Stability Score — how "smooth" both trajectories are
   Formula: min_length / actual_alignment_length
   High (~0.9): Steady progressions without jumps
   Low (~0.5): Required much "stretching" to align

Total Score: shape + tempo + stability (max = 3.0)
- > 2.5: Very similar trajectories — highly relevant
- 2.0-2.5: Similar — worth considering
- 1.5-2.0: Moderate similarity — some differences
- < 1.5: Different trajectories — less relevant

RESPONSE RULES:
1. ALWAYS cite evidence: "Candidate #2 (Senior at Google) transitioned in 2.5 years..."
2. Build logical chains: "Since most pathfinders know Go → and you don't → this is a key gap"
3. Be honest about uncertainty: "I can see X, but I don't have data on Y"
4. Use feedback field when available — it contains candidate's reflection on their transition
5. Keep responses focused (2-4 paragraphs)
6. End with actionable insight when appropriate
7. Respond in user's language`;

/**
 * Advisor intent classification prompt.
 * Simpler than search intent — only ask (continue) or done (finish).
 */
export const ADVISOR_INTENT_PROMPT = `Classify user's intent in advisor conversation. Response may be in any language.

Intents:
- ASK: User asks another question, wants more information, or continues the conversation
- DONE: User explicitly finishes, says thanks, goodbye, or indicates they're satisfied

Return: { intent: "ask" | "done" }`;
