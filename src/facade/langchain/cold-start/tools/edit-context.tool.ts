import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { coldStartPhaseSchema } from "../types.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

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

function buildCorrectionPrompt(
  original: UserContext,
  corrections: string,
  messages: BaseMessage[],
): string {
  const messagesText = messages.map((m) => `${m.type}: ${m.content}`).join("\n");

  return `Apply corrections to the following career context.

ORIGINAL CONTEXT:
${JSON.stringify(original, null, 2)}

USER CORRECTIONS:
${corrections}

CONVERSATION HISTORY (for additional context):
${messagesText}

═══════════════════════════════════════════════════
TASK: Return the COMPLETE corrected context object
═══════════════════════════════════════════════════

Apply the user's corrections while preserving all other fields.
Return the full context with corrections applied.
DO NOT return partial data - include ALL fields from the original.`;
}

function findContext(contexts: UserContext[], contextId: string): UserContext | undefined {
  return contexts.find((ctx) => ctx.contextId === contextId);
}

function replaceContext(contexts: UserContext[], updated: UserContext): UserContext[] {
  return contexts.map((ctx) => (ctx.contextId === updated.contextId ? updated : ctx));
}

export const editContextTool = tool(
  async ({ contextId, corrections }: EditContextInput, toolConfig: { state: ColdStartState }) => {
    const { collectedContexts, messages } = toolConfig.state;

    const original = findContext(collectedContexts, contextId);
    if (!original) {
      console.error(`❌ edit_context: context ${contextId} not found`);
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
      });
    }

    console.log(`🔧 edit_context: applying corrections to ${contextId}`);

    const prompt = buildCorrectionPrompt(original, corrections, messages);
    const extracted = await contextCorrectionModel.invoke([new HumanMessage(prompt)]);

    const correctedContext: UserContext = {
      ...extracted,
      contextId: original.contextId,
      previousContextId: original.previousContextId,
      nextContextId: original.nextContextId,
      createdAt: original.createdAt,
    };

    const validation = userContextSchema.safeParse(correctedContext);
    if (!validation.success) {
      console.error(`❌ edit_context: validation failed`, validation.error.flatten());
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
      });
    }

    const updatedContexts = replaceContext(collectedContexts, validation.data);

    return new Command({
      update: {
        collectedContexts: updatedContexts,
        phase: coldStartPhaseSchema.Values.awaiting_context_confirmation,
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
