import { type SearchPhase, PHASE } from "./state.js";

/**
 * Builds goal extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildGoalExtractionPrompt(hints: string): string {
  return `Extract career goal from user's message. Response may be in any language.
${hints}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical area (WHICH field) — map to KNOWN DOMAINS

MODE: "desired" by default, "undesired" if user says "not", "avoid", "except"

Return null for fields not mentioned.`;
}

const PHASE_CONTEXT: Partial<Record<SearchPhase, string>> = {
  [PHASE.confirming_adhoc_context]: `User just described themselves. Bot confirmed their profile and offered options:
  - Set a career goal
  - Explore similar people without goal
  If user mentions a goal → CLARIFY. If user agrees to explore → PROCEED.`,

  [PHASE.showing_exploration_candidates]: `Bot showed similar people (no goal set). Options offered:
  - Set a goal to find paths
  - Apply filters
  - Stop
  If user mentions a goal → CLARIFY. If user wants to filter → FILTER.`,

  [PHASE.showing_exploration_facets]: `Bot showed facets (too many results). Options offered:
  - Set a goal to find paths
  - Apply filters to narrow down
  - Stop
  If user mentions a goal → CLARIFY. If user wants to filter → FILTER.`,

  [PHASE.showing_goal]: `Bot showed extracted career goal. Options offered:
  - Check with real people who made it (validate)
  - Tweak something (clarify)
  - Save and search
  If user wants to check/verify/see examples → VALIDATE. If user confirms saving → SAVE.`,

  [PHASE.asking_after_validate_candidates]: `Bot showed people who achieved the goal. Options offered:
  - Save the goal
  - Change something
  - Adjust goal
  If user agrees/confirms → SAVE. If user wants different goal → CHANGE.`,

  [PHASE.asking_after_validate_facets]: `Bot showed facets for pathfinders (too many results). Options offered:
  - Save the goal
  - Apply filters to narrow down
  - Adjust goal
  If user agrees/confirms → SAVE. If user wants different goal → CHANGE.`,

  [PHASE.showing_results]: `Bot showed final search results. Options offered:
  - Change goal
  - Delete goal
  - Filter more
  - Ask questions about results
  If user has question → ASK. If user wants to filter → FILTER.`,
};

const BASE_INTENT_PROMPT = `Classify user's intent in career search conversation.

CRITICAL: Consider the FULL MEANING of the message in context of what was just offered.

Intents:

PROCEED — User agrees to continue WITHOUT adding new information
  Semantic: simple confirmation, agreement to proceed with current state

CLARIFY — User provides NEW goal-related information
  Semantic: mentions career goal, desired position, skills to add, location preference
  + clarificationText: user's full message

VALIDATE — User wants to see REAL PEOPLE who achieved similar goals
  Semantic: requests verification, wants proof, asks to check feasibility, see examples
  + filters or null

SAVE — User confirms SAVING the goal
  Semantic: explicit confirmation to save, finalize, remember

CHANGE — User wants a DIFFERENT goal entirely
  Semantic: rejection of current goal + new direction

DELETE — User wants to REMOVE the goal
  Semantic: delete, remove, clear goal

FILTER — User wants to NARROW DOWN results
  Semantic: exclude something, filter by criteria, limit scope
  + filters or null

ASK — User asks a QUESTION about results/candidates
  Semantic: question about data shown, why/how/who questions
  + question: user's question text

CANCEL — User wants to STOP the flow
  Semantic: stop, exit, abort, cancel

UNKNOWN — Unclear or unrelated

Return:
{
  reasoning: "Brief explanation considering phase context",
  intent: "...",
  clarificationText/filters/question: (if applicable)
}`;

export function buildUserIntentPrompt(phase: SearchPhase): string {
  const phaseContext = PHASE_CONTEXT[phase];
  if (!phaseContext) {
    return BASE_INTENT_PROMPT;
  }

  return `Current phase context:
${phaseContext}

${BASE_INTENT_PROMPT}`;
}

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
 * Builds adhoc context extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildAdhocExtractionPrompt(hints: string): string {
  return `Extract career context from user's professional self-description.
${hints}
Fields to extract (map to KNOWN values from hints):
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical specialization — map to KNOWN DOMAINS
- industry: business sector — map to KNOWN INDUSTRIES

RULES:
1. Extract ONLY from self-descriptions
2. Commands and requests are NOT self-descriptions → return null for ALL fields
3. NEVER return empty strings "" — use JSON null instead
4. NEVER return string representations of null like "null", "/null", "NULL" — use JSON null
5. If field not explicitly stated → null`;
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
