import { PHASE } from "./types.js";

import type { ColdStartPhase } from "./types.js";

/* eslint-disable @typescript-eslint/naming-convention -- LangChain tool names use snake_case */
export const TOOL_NAME = {
  plan_career_history: "plan_career_history",
  show_plan: "show_plan",
  confirm_plan: "confirm_plan",
  process_entity_batch: "process_entity_batch",
  show_context: "show_context",
  confirm_context: "confirm_context",
  ask_clarification: "ask_clarification",
  edit_context: "edit_context",
  edit_trail: "edit_trail",
  show_final: "show_final",
  confirm_final: "confirm_final",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type ToolName = (typeof TOOL_NAME)[keyof typeof TOOL_NAME];

type PhasePrerequisite = { type: "tool"; name: ToolName } | { type: "none" };

export const PHASE_PREREQUISITES: Record<ColdStartPhase, PhasePrerequisite> = {
  [PHASE.story_gathering]: { type: "none" },
  [PHASE.awaiting_plan_confirmation]: { type: "tool", name: TOOL_NAME.show_plan },
  [PHASE.awaiting_clarification]: { type: "tool", name: TOOL_NAME.ask_clarification },
  [PHASE.awaiting_context_confirmation]: { type: "tool", name: TOOL_NAME.show_context },
  [PHASE.awaiting_final_confirmation]: { type: "tool", name: TOOL_NAME.show_final },
  [PHASE.saved]: { type: "tool", name: TOOL_NAME.confirm_final },
  [PHASE.already_saved]: { type: "none" },
  [PHASE.failed]: { type: "none" },
};

export function getRequiredToolNames(phases: ColdStartPhase[]): string | null {
  const toolNames = phases
    .map((phase) => PHASE_PREREQUISITES[phase])
    .filter((prereq): prereq is { type: "tool"; name: ToolName } => prereq.type === "tool")
    .map((prereq) => prereq.name);

  return toolNames.length > 0 ? toolNames.join(" or ") : null;
}
