import { tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchema } from "../../../shared/schemas.js";

/**
 * Show extracted career data for user confirmation.
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * The tool body NEVER executes. Calling code must format message using formatPreview
 * helper and set it in state BEFORE calling this tool.
 */
export const confirmDataTool = tool(
  () => {
    // This body NEVER executes due to humanInTheLoopMiddleware interrupt.
    // Calling code handles message formatting and state update.
  },
  {
    name: "confirm_data",
    description: "Show extracted career data for user confirmation",
    schema: z.object({
      contexts: z.array(userContextSchema).describe("Array of normalized career contexts"),
      trails: z.array(trailSchema).describe("Array of career transitions"),
    }),
  },
);
