import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { contextCorrectionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";

const editContextInputSchema = z.object({
  contextId: z.string().describe("Context ID to edit (ctx_<UUID>)"),
  corrections: z
    .string()
    .describe("User's correction instructions (e.g., 'change position to Senior')"),
});

type EditContextInput = z.infer<typeof editContextInputSchema>;

const contextCorrectionModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
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
  async ({ contextId, corrections }: EditContextInput, { state }: { state: ColdStartState }) => {
    const { collectedContexts, messages } = state;

    const existingContext = findContext(collectedContexts, contextId);
    if (!existingContext) {
      console.error(`❌ edit_context: context ${contextId} not found`);
      return new Command({
        update: { phase: PHASE.failed },
      });
    }

    console.log(`🔧 edit_context: applying corrections to ${contextId}`);

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
      console.error(`❌ edit_context: validation failed`, parseResult.error.flatten());
      return new Command({
        update: { phase: PHASE.failed },
      });
    }

    const updatedContexts = replaceContext(collectedContexts, parseResult.data);

    return new Command({
      update: {
        collectedContexts: updatedContexts,
        phase: PHASE.awaiting_context_confirmation,
      },
      goto: "confirm_context",
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
