import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { phaseGuard } from "../../shared-tools/guards.js";
import { getModel } from "../../shared-tools/models.js";
import { contextExtractionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UpsertContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

function buildContextWithIds(extracted: z.infer<typeof extractableContextSchema>): z.infer<typeof userContextSchema> {
  return {
    ...extracted,
    contextId: `ctx_${uuidv7()}`,
    previousContextId: null,
    nextContextId: null,
  };
}

export const extractContextTool = tool(
  async ({ userMessage }: { userMessage: string }, runtime: ToolRuntime<UpsertContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.extracting, toolCallId);
    if (guard) return guard;

    const { messages } = state;

    const prompt = contextExtractionPrompt(userMessage, messages);
    const extracted = await extractionModel.invoke([new HumanMessage(prompt)]);
    const fullContext = buildContextWithIds(extracted);

    const validation = userContextSchema.safeParse(fullContext);

    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.path.join(".")).join(", ");
      return new Command({
        update: {
          phase: PHASE.failed,
          extractedContext: extracted,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Extraction failed. Missing/invalid fields: ${errors}. Ask user for clarification.`,
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
        extractedContext: extracted,
        validatedContext: validation.data,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Context extracted successfully. Now call ${TOOL_NAME.show_context} to present to user.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.extract_context,
    description:
      "Extract career context from user's NLP message. " +
      `After success: call ${TOOL_NAME.show_context} to show to user.`,
    schema: z.object({
      userMessage: z.string().describe("User's description of their career context in natural language"),
    }),
  },
);
