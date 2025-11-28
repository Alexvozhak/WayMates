import { tool } from "langchain";
import { z } from "zod";

/**
 * Show extracted context + related trails for user confirmation.
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * The tool body NEVER executes. Called via goto from processEntityBatchTool.
 * Data (entity, trails, progress) is already in state - no parameters needed.
 */
export const confirmContextTool = tool(
  () => {
    // This body NEVER executes due to humanInTheLoopMiddleware interrupt.
    // State already contains entity, trails, progress for LibreChat to format.
  },
  {
    name: "confirm_context",
    description:
      "Show extracted context + trails for user confirmation. Called via goto - no parameters needed, data is in state.",
    schema: z.object({}),
  },
);
