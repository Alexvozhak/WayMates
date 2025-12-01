import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { phaseGuard } from "../../shared-tools/guards.js";
import { getModel } from "../../shared-tools/models.js";
import { contextEditPrompt } from "../prompts.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { UpdateContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const editInputSchema = z.object({
  corrections: z.string().describe("User's correction instructions (e.g., 'change position to Senior')"),
});

type EditInput = z.infer<typeof editInputSchema>;

const correctionModel = getModel("extraction")
  .withStructuredOutput(extractableContextSchema)
  .withRetry({ stopAfterAttempt: 2 });

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
  async ({ corrections }: EditInput, runtime: ToolRuntime<UpdateContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_confirmation, toolCallId);
    if (guard) return guard;

    const { updatedContext, messages } = state;
    if (!updatedContext) {
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

    const prompt = contextEditPrompt(updatedContext, corrections, messages);
    const extracted = await correctionModel.invoke([new HumanMessage(prompt)]);
    const corrected = restoreSystemFields(updatedContext, extracted);

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
        updatedContext: parseResult.data,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Context updated. Now call ${TOOL_NAME.show_updated_context} to present to user.`,
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
