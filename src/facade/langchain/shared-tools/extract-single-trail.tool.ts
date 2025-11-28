import { tool } from "langchain";
import { z } from "zod";

import { trailExtractionModel } from "./extraction-models.js";

export { extractableTrailSchema } from "./extraction-models.js";
export type { ExtractableTrail } from "./extraction-models.js";

import type { ExtractableTrail } from "./extraction-models.js";

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
    console.log(`🔧 extract_single_trail called with ${text.length} chars`);

    const prompt = `Extract ONE career transition (trail) from the following text.
Focus on extracting: main skill being developed, learning platform used, course name, duration in weeks, cost in USD, and ratings.

A trail represents the journey BETWEEN two positions - what led someone from one role to the next.
Look for: courses taken, certifications earned, skills developed, platforms used (Coursera, Udemy, etc).

If multiple transitions are present, extract only the FIRST one.
Return null if no transition information is found.

Text:
${text}`;

    try {
      const extracted = await trailExtractionModel.invoke([{ role: "user", content: prompt }]);

      if (!extracted) {
        return null;
      }

      return extracted;
    } catch (error) {
      console.error("Failed to extract single trail:", error);
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
