import { tool } from "langchain";
import { z } from "zod";

/**
 * Ask batch of clarifying questions to the user.
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * The tool body NEVER executes. Called via goto from processEntityBatchTool.
 * Data (missingFields, currentEntityContext) is already in state - no parameters needed.
 */
export const askClarificationTool = tool(
  () => {
    // This body NEVER executes due to humanInTheLoopMiddleware interrupt.
    // State already contains missingFields for LibreChat to format.
  },
  {
    name: "ask_clarification",
    description:
      "Ask clarifying questions for missing fields. Called via goto - no parameters needed, data is in state.",
    schema: z.object({}),
  },
);
