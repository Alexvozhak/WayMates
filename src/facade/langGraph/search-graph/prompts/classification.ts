// ============================================================================
// CLASSIFICATION PROMPTS
// Classify user intent within SearchGraph
// ============================================================================

import { getValidIntentsForPhase } from "../search-router.js";

import type { RouteFlags } from "../search-router.js";
import type { SearchPhase, SearchUserIntent } from "../state.js";

// ============================================================================
// EXPORTED FUNCTIONS (public API)
// ============================================================================

/**
 * Builds user intent classification prompt with phase context.
 * Valid intents are derived from the router (single source of truth).
 */
export function buildUserIntentPrompt(phase: SearchPhase, flags: RouteFlags): string {
  const validIntents = getValidIntentsForPhase(phase, flags);

  if (validIntents.length === 0) {
    return `Phase "${phase}" has no valid intents. Return: { reasoning: "No valid intents", intent: "cancel" }`;
  }

  const intentSection = validIntents.map((intent) => `${intent} — ${INTENT_DESCRIPTIONS[intent]}`).join("\n\n");

  return `Classify user's intent in career search conversation.

CRITICAL: Pick ONE intent from the list below. These are the ONLY valid options.

Intents:

${intentSection}

Return:
{
  reasoning: "Brief explanation of why this intent fits",
  intent: "<one of: ${validIntents.join(", ")}>",
  clarificationText/filters/question: (if applicable)
}`;
}

// ============================================================================
// LOCAL CONSTANTS
// ============================================================================

// Intent descriptions - keys must match SearchUserIntent (TypeScript enforces completeness)
const INTENT_DESCRIPTIONS: Record<SearchUserIntent, string> = {
  proceed: `User agrees to continue WITHOUT adding new information
  Semantic: simple confirmation, agreement to proceed with current state`,
  explore: `User wants to SEE SIMILAR PEOPLE without setting a goal
  Semantic: browse, look around, show matches, find similar, explore options`,
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
