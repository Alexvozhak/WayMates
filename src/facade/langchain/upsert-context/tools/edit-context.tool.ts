import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { contextCorrectionModel } from "../../shared-tools/extraction-models.js";
import { phaseGuard } from "../../shared-tools/guards.js";
import { contextEditPrompt } from "../prompts.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { UpsertContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const editInputSchema = z.object({
  corrections: z.string().describe("User's correction instructions (e.g., 'change position to Senior')"),
});

type EditInput = z.infer<typeof editInputSchema>;

function restoreSystemFields(existing: UserContext, extracted: ExtractableContext): Partial<UserContext> {
  return {
    ...extracted,
    contextId: existing.contextId,
    previousContextId: existing.previousContextId,
    nextContextId: existing.nextContextId,
    createdAt: existing.createdAt,
  };
}

export const editContextTool = tool(
  async ({ corrections }: EditInput, runtime: ToolRuntime<UpsertContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_confirmation, toolCallId);
    if (guard) return guard;

    const { validatedContext, messages } = state;
    if (!validatedContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "No context to edit.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const prompt = contextEditPrompt(validatedContext, corrections, messages);
    const extracted = await contextCorrectionModel.invoke([new HumanMessage(prompt)]);
    const corrected = restoreSystemFields(validatedContext, extracted);

    const parseResult = userContextSchema.safeParse(corrected);
    if (!parseResult.success) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Validation failed after correction.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    return new Command({
      update: {
        validatedContext: parseResult.data,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Context updated. Now call ${TOOL_NAME.show_context} to present to user.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.edit_context,
    description: "Apply corrections to context. " + "Use for edits like 'change position to Senior' or 'add Python'.",
    schema: editInputSchema,
  },
);
