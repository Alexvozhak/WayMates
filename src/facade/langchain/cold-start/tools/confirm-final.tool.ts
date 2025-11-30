import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";

import { assertStateValid, dataGuardForSave, phaseGuard } from "./guards.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmFinalTool = tool(
  (_, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;

    assertStateValid(state, "confirm_final");

    const guard = phaseGuard(state.phase, PHASE.awaiting_final_confirmation, toolCallId);
    if (guard) return guard;

    const dataGuard = dataGuardForSave(state, toolCallId);
    if (dataGuard) return dataGuard;

    return new Command({
      update: {
        phase: PHASE.saved,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: "Career history saved successfully!",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "confirm_final",
    description:
      "Confirm save. Call when user APPROVED final preview (да, ok, yes, save, сохранить). " +
      "You must analyze userResponse from show_final first.",
    schema: z.object({}),
  },
);
