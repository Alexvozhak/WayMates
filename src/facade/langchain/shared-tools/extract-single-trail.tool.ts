import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema } from "../../../shared/schemas.js";

// For extraction, we omit context IDs since they will be added during linking
const extractableTrailSchema = trailSchema.omit({
  fromContextId: true,
  toContextId: true,
});

// Model with structured output for guaranteed JSON
const extractionModel = new ChatGoogleGenerativeAI({
  model: "models/gemini-2.0-flash",
  temperature: 0.2,
}).withStructuredOutput(extractableTrailSchema);

/**
 * Extract ONE career transition (trail) from text using structured output.
 * Returns partial trail data (without context IDs which are added later).
 * Atomic tool following ONE entity operation principle.
 */
export const extractSingleTrailTool = tool(
  async ({ text }: { text: string }): Promise<z.infer<typeof extractableTrailSchema> | null> => {
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
      const extracted = await extractionModel.invoke([{ role: "user", content: prompt }]);

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
