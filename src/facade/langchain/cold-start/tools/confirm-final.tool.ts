import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";

/**
 * Show final preview of ALL collected data for user confirmation before save.
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * But unlike confirm_context/confirm_plan, this tool DOES execute to set phase.
 * The interrupt happens AFTER execution (tool result is stored before interrupt).
 */
export const confirmFinalTool = tool(
  () => {
    console.log("🔧 confirm_final: setting phase to awaiting_final_confirmation");

    return new Command({
      update: { phase: PHASE.awaiting_final_confirmation },
    });
  },
  {
    name: "confirm_final",
    description:
      "Show final preview of ALL collected career history for user confirmation before save. " +
      "Call when all contexts are processed (progress.current == progress.total).",
    schema: z.object({}),
  },
);
