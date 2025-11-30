import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";

import { phaseGuard } from "./guards.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmPlanTool = tool(
  (_, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_plan_confirmation, toolCallId);
    if (guard) return guard;

    return new Command({
      update: {
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content:
              "Plan confirmed. Now call process_entity_batch to start extraction (contextIndex: 0).",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "confirm_plan",
    description:
      "Confirm plan. Call when user APPROVED (да, ok, yes, подтверждаю, норм). " +
      "You must analyze userResponse from show_plan first.",
    schema: z.object({}),
  },
);
