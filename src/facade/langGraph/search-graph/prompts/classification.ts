// ============================================================================
// CLASSIFICATION PROMPTS
// Classify user intent within SearchGraph
// ============================================================================

import { getValidIntentsForPhase } from "../search-router.js";
import { PHASE } from "../state.js";

import type { RouteFlags } from "../search-router.js";
import type { SearchPhase, SearchUserIntent } from "../state.js";

// Phase-specific context hints for intent classification
const PHASE_CONTEXT: Partial<Record<SearchPhase, string>> = {
  [PHASE.showing_pathfinder_results]: "Pathfinder results are ALREADY displayed. Questions about shown results = ask.",
  [PHASE.showing_waymate_results]: "Waymate results are ALREADY displayed. Questions about shown results = ask.",
  [PHASE.asking_search_mode]: "Goal just saved. User choosing between pathfinders and waymates.",
};

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
  const phaseHint = PHASE_CONTEXT[phase] ?? "";

  return `Classify user's intent in career search conversation.

CRITICAL: Pick ONE intent from the list below. These are the ONLY valid options.

Context:
- Adhoc = user's CURRENT situation (where they are now)
- Goal = user's TARGET position (where they want to go)
- Adding criteria to narrow results = edit adhoc
- Removing criteria to broaden results = filter
${phaseHint ? `- ${phaseHint}` : ""}

Intents:

${intentSection}

Return:
{
  reasoning: "Brief explanation of why this intent fits",
  intent: "<one of: ${validIntents.join(", ")}>",
  filters/question: (if applicable)
}`;
}

// ============================================================================
// LOCAL CONSTANTS
// ============================================================================

// Intent descriptions - keys must match SearchUserIntent (TypeScript enforces completeness)
const INTENT_DESCRIPTIONS: Record<SearchUserIntent, string> = {
  proceed: `User confirms and wants to MOVE FORWARD
  Semantic: confirmation without new information, agreement to continue`,
  explore: `User wants to SEE SIMILAR PEOPLE without setting a goal
  Semantic: browse, look around, show matches, find similar, explore options`,
  clarify: `User MODIFIES goal: adds, removes part, or corrects
  Semantic: "also want fintech", "remove backend", "change role to architect", partial goal edits`,
  validate: `User wants to see REAL PEOPLE who achieved similar goals
  Semantic: requests verification, wants proof, asks to check feasibility, see examples
  + filters or null`,
  save: `User confirms SAVING the goal
  Semantic: explicit confirmation to save, finalize, remember`,
  change: `User wants a DIFFERENT goal entirely
  Semantic: rejection of current goal + new direction`,
  delete: `User wants to REMOVE the goal
  Semantic: delete, remove, clear goal`,
  filter: `User wants to RELAX matching by ignoring a comparison field
  Semantic: remove restriction, ignore dimension, broaden search
  + filters or null`,
  ask: `User asks a QUESTION about results, capabilities, or the system
  Semantic: why/how/who questions, help requests, meta-questions about bot capabilities
  + question: user's question text`,
  searchWaymates: `User wants to see WAYMATES (peers with same goal)
  Semantic: wants similar people, peers, networking, fellow travelers`,
  searchPathfinders: `User wants to see PATHFINDERS (proof of transition)
  Semantic: wants people who made it, proof, who achieved, concrete paths`,
  setGoal: `User wants to SET a career goal (when no goal exists)
  Semantic: expresses aspiration, career target, desired position`,
  editGoal: `User wants to MODIFY existing goal
  Semantic: adjust target, change destination, update goal`,
  editAdhoc: `User wants to NARROW search by adding criteria to their profile
  Semantic: add industry, specify skill, tighten search, correction about self`,
  cancel: `User wants to STOP the flow
  Semantic: stop, exit, abort, cancel`,
  done: `User is SATISFIED and finished asking questions
  Semantic: thanks, that's all, enough, satisfied, finished`,
  unknown: `Unclear or unrelated`,
};
