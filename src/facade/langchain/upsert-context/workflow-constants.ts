/* eslint-disable @typescript-eslint/naming-convention -- LangChain tool names use snake_case */
export const TOOL_NAME = {
  extract_context: "extract_context",
  show_context: "show_context",
  confirm_context: "confirm_context",
  edit_context: "edit_context",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type ToolName = (typeof TOOL_NAME)[keyof typeof TOOL_NAME];
