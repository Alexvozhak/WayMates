import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { trailCorrectionPrompt } from "../prompts.js";
import { PHASE } from "../types.js";

import type { Trail } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";

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

function findTrail(trails: Trail[], trailId: string): Trail | undefined {
  return trails.find((t) => t.trailId === trailId);
}

function replaceTrail(trails: Trail[], updated: Trail): Trail[] {
  return trails.map((t) => (t.trailId === updated.trailId ? updated : t));
}

export const editTrailTool = tool(
  async ({ trailId, corrections }: EditTrailInput, { state }: { state: ColdStartState }) => {
    const { collectedTrails, messages } = state;

    const existingTrail = findTrail(collectedTrails, trailId);
    if (!existingTrail) {
      console.error(`❌ edit_trail: trail ${trailId} not found`);
      return new Command({
        update: { phase: PHASE.failed },
      });
    }

    console.log(`🔧 edit_trail: applying corrections to ${trailId}`);

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
      console.error(`❌ edit_trail: validation failed`, parseResult.error.flatten());
      return new Command({
        update: { phase: PHASE.failed },
      });
    }

    const updatedTrails = replaceTrail(collectedTrails, parseResult.data);

    return new Command({
      update: {
        collectedTrails: updatedTrails,
        phase: PHASE.awaiting_context_confirmation,
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
