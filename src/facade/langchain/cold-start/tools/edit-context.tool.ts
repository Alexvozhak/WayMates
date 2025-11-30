import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { contextCorrectionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const editContextInputSchema = z.object({
  contextId: z.string().describe("Context ID to edit (ctx_<UUID>)"),
  corrections: z
    .string()
    .describe("User's correction instructions (e.g., 'change position to Senior')"),
});

type EditContextInput = z.infer<typeof editContextInputSchema>;

const contextCorrectionModel = new ChatOpenAI({
  modelName: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
})
  .withStructuredOutput(extractableContextSchema)
  .withRetry({ stopAfterAttempt: 2 });

function findContext(contexts: UserContext[], contextId: string): UserContext | undefined {
  return contexts.find((ctx) => ctx.contextId === contextId);
}

function replaceContext(contexts: UserContext[], updated: UserContext): UserContext[] {
  return contexts.map((ctx) => (ctx.contextId === updated.contextId ? updated : ctx));
}

export const editContextTool = tool(
  async ({ contextId, corrections }: EditContextInput, runtime: ToolRuntime<ColdStartState>) => {
    const { state, toolCallId } = runtime;
    const { collectedContexts, messages } = state;

    const existingContext = findContext(collectedContexts, contextId);
    if (!existingContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Context ${contextId} not found`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const prompt = contextCorrectionPrompt(existingContext, corrections, messages);
    const extracted = await contextCorrectionModel.invoke([new HumanMessage(prompt)]);

    const correctedContext: UserContext = {
      ...extracted,
      contextId: existingContext.contextId,
      previousContextId: existingContext.previousContextId,
      nextContextId: existingContext.nextContextId,
      createdAt: existingContext.createdAt,
    };

    const parseResult = userContextSchema.safeParse(correctedContext);
    if (!parseResult.success) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Context validation failed after correction",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const updatedContexts = replaceContext(collectedContexts, parseResult.data);

    return new Command({
      update: {
        collectedContexts: updatedContexts,
        phase: PHASE.awaiting_context_confirmation,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Context ${contextId} updated. Now call show_context to present updated data to user.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "edit_context",
    description:
      "Apply corrections to a career context. " +
      "LLM re-extracts the full corrected object from user instructions. " +
      "Use for corrections like 'change position to Senior' or 'add Python skill'.",
    schema: editContextInputSchema,
  },
);
