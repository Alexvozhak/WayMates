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
