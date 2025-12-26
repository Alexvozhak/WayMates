// ============================================================================
// CLASSIFICATION PROMPTS
// Classify user intent within SearchGraph
// ============================================================================

import { AgentInvariantError } from "../../../errors.js";

import type { SearchPhase, SearchUserIntent } from "../state.js";

// ============================================================================
// EXPORTED FUNCTIONS (public API)
// ============================================================================

/**
 * Builds user intent classification prompt with phase context.
 * @param phase - Current search phase (determines valid intents)
 */
export function buildUserIntentPrompt(phase: SearchPhase): string {
  const phaseContext = PHASE_CONTEXT[phase];
  if (!phaseContext) {
    throw new AgentInvariantError("buildUserIntentPrompt", `Missing PHASE_CONTEXT for phase: ${phase}`);
  }

  return `Current phase context:
${phaseContext}

${BASE_INTENT_PROMPT}`;
}

// ============================================================================
// LOCAL CONSTANTS
// ============================================================================

// Intent descriptions - keys must match SearchUserIntent (TypeScript enforces completeness)
const INTENT_DESCRIPTIONS: Record<SearchUserIntent, string> = {
  proceed: `User agrees to continue WITHOUT adding new information
  Semantic: simple confirmation, agreement to proceed with current state`,
  clarify: `User provides NEW goal-related information
  Semantic: mentions career goal, desired position, skills to add, location preference
  + clarificationText: user's full message`,
  validate: `User wants to see REAL PEOPLE who achieved similar goals
  Semantic: requests verification, wants proof, asks to check feasibility, see examples
  + filters or null`,
  save: `User confirms SAVING the goal
  Semantic: explicit confirmation to save, finalize, remember`,
  change: `User wants a DIFFERENT goal entirely
  Semantic: rejection of current goal + new direction`,
  delete: `User wants to REMOVE the goal
  Semantic: delete, remove, clear goal`,
  filter: `User wants to NARROW DOWN results
  Semantic: exclude something, filter by criteria, limit scope
  + filters or null`,
  ask: `User asks a QUESTION about results/candidates
  Semantic: question about data shown, why/how/who questions
  + question: user's question text`,
  searchWaymates: `User wants to see WAYMATES (peers with same goal)
  Semantic: wants similar people, peers, networking, fellow travelers`,
  searchPathfinders: `User wants to see PATHFINDERS (proof of transition)
  Semantic: wants people who made it, proof, who achieved, concrete paths`,
  cancel: `User wants to STOP the flow
  Semantic: stop, exit, abort, cancel`,
  unknown: `Unclear or unrelated`,
};

// Generate intent section from the map (single source of truth)
const INTENT_SECTION = Object.entries(INTENT_DESCRIPTIONS)
  .map(([intent, desc]) => `${intent} — ${desc}`)
  .join("\n\n");

// Type-safe intent list builder
const intents = (...names: SearchUserIntent[]): string => names.join(", ");

// Phase context - what options were offered to user in each phase
// ask is always valid — user can ask meta-questions anytime
const PHASE_CONTEXT: Partial<Record<SearchPhase, string>> = {
  confirming_adhoc_context: `User described themselves. Bot confirmed profile.
  Valid: ${intents("clarify", "proceed", "ask", "cancel")}`,

  showing_exploration_candidates: `Bot showed similar people (no goal set).
  Valid: ${intents("clarify", "filter", "ask", "cancel")}`,

  showing_exploration_facets: `Bot showed facets (too many results).
  Valid: ${intents("clarify", "filter", "ask", "cancel")}`,

  showing_goal: `Bot showed extracted goal.
  Valid: ${intents("validate", "clarify", "save", "ask", "cancel")}`,

  asking_after_validate_candidates: `Bot showed pathfinders who achieved the goal.
  Valid: ${intents("save", "change", "clarify", "ask", "cancel")}`,

  asking_after_validate_facets: `Bot showed pathfinder facets (too many).
  Valid: ${intents("save", "filter", "change", "ask", "cancel")}`,

  showing_results: `Bot showed search results.
  Valid: ${intents("change", "delete", "filter", "ask", "cancel")}`,

  asking_search_mode: `Bot saved goal and asks which search mode.
  Valid: ${intents("searchPathfinders", "searchWaymates", "ask", "cancel")}`,
};

const BASE_INTENT_PROMPT = `Classify user's intent in career search conversation.

CRITICAL: Consider the FULL MEANING of the message in context of what was just offered.

Intents:

${INTENT_SECTION}

Return:
{
  reasoning: "Brief explanation considering phase context",
  intent: "<one of: ${Object.keys(INTENT_DESCRIPTIONS).join(", ")}>",
  clarificationText/filters/question: (if applicable)
}`;
