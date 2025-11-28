import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { coldStartPhaseSchema } from "../types.js";

import type { Trail } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

const editTrailInputSchema = z.object({
  trailId: z.string().describe("Trail ID to edit (trl_<UUID>)"),
  corrections: z
    .string()
    .describe("User's correction instructions (e.g., 'change platform to Udemy')"),
});

type EditTrailInput = z.infer<typeof editTrailInputSchema>;

const trailCorrectionModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
})
  .withStructuredOutput(extractableTrailSchema)
  .withRetry({ stopAfterAttempt: 2 });

function buildCorrectionPrompt(
  original: Trail,
  corrections: string,
  messages: BaseMessage[],
): string {
  const messagesText = messages.map((m) => `${m.type}: ${m.content}`).join("\n");

  return `Apply corrections to the following learning trail.

ORIGINAL TRAIL:
${JSON.stringify(original, null, 2)}

USER CORRECTIONS:
${corrections}

CONVERSATION HISTORY (for additional context):
${messagesText}

═══════════════════════════════════════════════════
TASK: Return the COMPLETE corrected trail object
═══════════════════════════════════════════════════

Apply the user's corrections while preserving all other fields.
Return the full trail with corrections applied.
DO NOT return partial data - include ALL fields from the original.`;
}

function findTrail(trails: Trail[], trailId: string): Trail | undefined {
  return trails.find((t) => t.trailId === trailId);
}

function replaceTrail(trails: Trail[], updated: Trail): Trail[] {
  return trails.map((t) => (t.trailId === updated.trailId ? updated : t));
}

export const editTrailTool = tool(
  async ({ trailId, corrections }: EditTrailInput, toolConfig: { state: ColdStartState }) => {
    const { collectedTrails, messages } = toolConfig.state;

    const original = findTrail(collectedTrails, trailId);
    if (!original) {
      console.error(`❌ edit_trail: trail ${trailId} not found`);
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
      });
    }

    console.log(`🔧 edit_trail: applying corrections to ${trailId}`);

    const prompt = buildCorrectionPrompt(original, corrections, messages);
    const extracted = await trailCorrectionModel.invoke([new HumanMessage(prompt)]);

    const correctedTrail: Trail = {
      ...extracted,
      trailId: original.trailId,
      fromContextId: original.fromContextId,
      toContextId: original.toContextId,
    };

    const validation = trailSchema.safeParse(correctedTrail);
    if (!validation.success) {
      console.error(`❌ edit_trail: validation failed`, validation.error.flatten());
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
      });
    }

    const updatedTrails = replaceTrail(collectedTrails, validation.data);

    return new Command({
      update: {
        collectedTrails: updatedTrails,
        phase: coldStartPhaseSchema.Values.awaiting_context_confirmation,
      },
      goto: "confirm_context",
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
