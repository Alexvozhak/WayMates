/* eslint-disable @typescript-eslint/naming-convention -- LangChain tool names use snake_case */
export const TOOL_NAME = {
  extract_updates: "extract_updates",
  show_updated_context: "show_updated_context",
  edit_context: "edit_context",
  confirm_update: "confirm_update",
  ask_clarification: "ask_clarification",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type ToolName = (typeof TOOL_NAME)[keyof typeof TOOL_NAME];
