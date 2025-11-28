import { tool } from "langchain";
import { z } from "zod";

/**
 * Show career plan (queue) for user confirmation.
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * The tool body NEVER executes. Called via goto from planCareerHistoryTool.
 * Data (queue, phase) is already in state - no parameters needed.
 */
export const confirmPlanTool = tool(
  () => {
    // This body NEVER executes due to humanInTheLoopMiddleware interrupt.
    // State already contains queue and phase for LibreChat to format.
  },
  {
    name: "confirm_plan",
    description:
      "Show career plan for user confirmation. Called via goto - no parameters needed, data is in state.",
    schema: z.object({}),
  },
);
