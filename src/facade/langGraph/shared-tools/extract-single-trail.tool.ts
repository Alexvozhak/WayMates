import { HumanMessage } from "@langchain/core/messages";
import { tool } from "langchain";
import { z } from "zod";

import { logger } from "../../logger.js";
import { withReasoning } from "../../utils/llm-schemas.js";

import { extractableTrailSchema } from "./extraction-models.js";
import { getModel } from "./models.js";

export { extractableTrailSchema } from "./extraction-models.js";
export type { ExtractableTrail } from "./extraction-models.js";

import type { ExtractableTrail } from "./extraction-models.js";

const trailExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableTrailSchema, "Explain what trail/certification you extracted and why")
);

/**
 * Extract ONE career transition (trail) from text using structured output.
 * Returns partial trail data (without context IDs which are added later).
 * Atomic tool following ONE entity operation principle.
 *
 * NOTE: This tool is NOT used by cold-start agent (which calls extraction models directly
 * via processEntityBatchTool for efficiency). It exists for future agents:
 * - add_trail agent / trailLinkerAgent (TBD Session 3)
 * DO NOT DELETE - required for post-MVP agent reuse.
 */
export const extractSingleTrailTool = tool(
  async ({ text }: { text: string }): Promise<ExtractableTrail | null> => {
    const prompt = `Extract ONE career transition (trail) from the following text.

TEXT:
${text}

═══════════════════════════════════════════════════
REQUIRED FIELDS:
═══════════════════════════════════════════════════
- skill: Main skill being developed (e.g., "React", "Python")
- platform: Learning platform (e.g., "Coursera", "Udemy", "bootcamp", "self-study")

═══════════════════════════════════════════════════
OPTIONAL FIELDS:
═══════════════════════════════════════════════════
- totalDurationWeeks, schedule, costUsd, courseName, courseLink
- ratingCourse/ratingPlatform/ratingSchedule (1-5), userFeedback

A trail represents learning/transition between career positions.
If multiple transitions present, extract FIRST one only.
Return null if no transition found.`;

    try {
      const { reasoning, ...extracted } = await trailExtractionModel.invoke([new HumanMessage(prompt)]);
      logger.info({ reasoning }, "single trail extraction reasoning");

      if (!extracted) {
        return null;
      }

      return extracted;
    } catch (error) {
      logger.error({ err: error }, "Failed to extract single trail");
      return null;
    }
  },
  {
    name: "extract_single_trail",
    description: "Extract ONE career transition (trail) from text",
    schema: z.object({
      text: z.string().describe("Text containing career transition information"),
    }),
  },
);
