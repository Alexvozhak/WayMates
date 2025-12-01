import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { phaseGuard } from "../../shared-tools/guards.js";
import { getModel } from "../../shared-tools/models.js";
import { updateExtractionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { UpdateContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

async function extractUpdates(
  currentContext: UserContext,
  userMessage: string,
  state: UpdateContextState,
): Promise<Partial<UserContext>> {
  const prompt = updateExtractionPrompt(currentContext, userMessage, state.messages);
  return extractionModel.invoke([new HumanMessage(prompt)]);
}

function mergeUpdates(current: UserContext, extracted: Partial<UserContext>): UserContext {
  return {
    ...current,
    ...extracted,
    contextId: current.contextId,
    previousContextId: current.previousContextId,
    nextContextId: current.nextContextId,
    createdAt: current.createdAt,
  };
}

export const extractUpdatesTool = tool(
  async ({ userMessage }: { userMessage: string }, runtime: ToolRuntime<UpdateContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.collecting, toolCallId);
    if (guard) return guard;

    const { currentContext } = state;
    if (!currentContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "No current context loaded. Cannot apply updates.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const extracted = await extractUpdates(currentContext, userMessage, state);
    const merged = mergeUpdates(currentContext, extracted);
    const validation = userContextSchema.safeParse(merged);

    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.path.join(".")).join(", ");
      return new Command({
        update: {
          phase: PHASE.awaiting_clarification,
          extractedUpdates: extracted,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Validation failed for: ${errors}. Call ask_clarification.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    return new Command({
      update: {
        phase: PHASE.awaiting_confirmation,
        updatedContext: validation.data,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Updates extracted. Now call ${TOOL_NAME.show_updated_context} to present diff to user.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.extract_updates,
    description:
      "Extract updates from user's NLP message and apply to current context. " +
      `After success: call ${TOOL_NAME.show_updated_context}.`,
    schema: z.object({
      userMessage: z.string().describe("User's update request in natural language"),
    }),
  },
);
