import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { trailCorrectionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";

import type { Trail } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const editTrailInputSchema = z.object({
  trailId: z.string().describe("Trail ID to edit (trl_<UUID>)"),
  corrections: z
    .string()
    .describe("User's correction instructions (e.g., 'change platform to Udemy')"),
});

type EditTrailInput = z.infer<typeof editTrailInputSchema>;

const trailCorrectionModel = new ChatOpenAI({
  modelName: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
})
  .withStructuredOutput(extractableTrailSchema)
  .withRetry({ stopAfterAttempt: 2 });

function findTrail(trails: Trail[], trailId: string): Trail | undefined {
  return trails.find((t) => t.trailId === trailId);
}

function replaceTrail(trails: Trail[], updated: Trail): Trail[] {
  return trails.map((t) => (t.trailId === updated.trailId ? updated : t));
}

export const editTrailTool = tool(
  async ({ trailId, corrections }: EditTrailInput, runtime: ToolRuntime<ColdStartState>) => {
    const { state, toolCallId } = runtime;
    const { collectedTrails, messages } = state;

    const existingTrail = findTrail(collectedTrails, trailId);
    if (!existingTrail) {
      return new Command({
        update: {
          phase: PHASE.failed,
          messages: [
            // eslint-disable-next-line @typescript-eslint/naming-convention -- LangChain API
            new ToolMessage({ content: `Trail ${trailId} not found`, tool_call_id: toolCallId }),
          ],
        },
      });
    }

    const prompt = trailCorrectionPrompt(existingTrail, corrections, messages);
    const extracted = await trailCorrectionModel.invoke([new HumanMessage(prompt)]);

    const correctedTrail: Trail = {
      ...extracted,
      trailId: existingTrail.trailId,
      fromContextId: existingTrail.fromContextId,
      toContextId: existingTrail.toContextId,
    };

    const parseResult = trailSchema.safeParse(correctedTrail);
    if (!parseResult.success) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Trail validation failed after correction",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const updatedTrails = replaceTrail(collectedTrails, parseResult.data);

    return new Command({
      update: {
        collectedTrails: updatedTrails,
        phase: PHASE.awaiting_context_confirmation,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Trail ${trailId} updated. Now call confirm_context to get user approval.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "edit_trail",
    description:
      "Apply corrections to a learning trail. " +
      "LLM re-extracts the full corrected object from user instructions. " +
      "Use for corrections like 'change platform to Coursera' or 'add duration 8 weeks'.",
    schema: editTrailInputSchema,
  },
);
