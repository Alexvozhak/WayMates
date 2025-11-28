import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { contextExtractionModel } from "./extraction-models.js";

import type { UserContext } from "../../../shared/schemas.js";

/**
 * Extract ONE career context from text using STRICT UserContext schema.
 * LLM attempts to fill all required fields, but may return incomplete data.
 * Returns Partial<UserContext> - validation happens in orchestrator (extractCareerDataTool).
 * Atomic tool following ONE entity operation principle.
 *
 * NOTE: This tool is NOT used by cold-start agent (which calls extraction models directly
 * via processEntityBatchTool for efficiency). It exists for future agents:
 * - add_context agent (TBD Session 2)
 * - contextUpdaterAgent (TBD Session 4)
 * DO NOT DELETE - required for post-MVP agent reuse.
 */
export const extractSingleContextTool = tool(
  async ({ text }: { text: string }): Promise<Partial<UserContext> | null> => {
    console.log(`🔧 extract_single_context called with ${text.length} chars`);

    const prompt = `Extract ONE career position from the following text.

Extract ALL available information:
- REQUIRED: position title, skills (array), industry, company size, location (cityName + countryCode), domains (array)
- OPTIONAL: education level, salary info, languages, feedback
- SYSTEM (extract if present): createdAt (ISO date), creationReason (array)

If multiple positions are present, extract only the FIRST one.
Return null if no career position information is found.

Text:
${text}`;

    try {
      const extracted = await contextExtractionModel.invoke([{ role: "user", content: prompt }]);

      if (!extracted) {
        return null;
      }

      // Filter out undefined values (LLM may return { field: undefined } for fields it couldn't extract)
      // This prevents undefined from overwriting existing data during merge operations
      const cleanExtracted = Object.fromEntries(
        Object.entries(extracted).filter(([_, value]) => value !== undefined),
      ) as Partial<UserContext>;

      // Generate contextId for extracted partial context
      return {
        ...cleanExtracted,
        contextId: `ctx_${uuidv7()}`,
      };
    } catch (error) {
      console.error("Failed to extract single context:", error);
      return null;
    }
  },
  {
    name: "extract_single_context",
    description: "Extract ONE career context (position) from text",
    schema: z.object({
      text: z.string().describe("Text containing career position information"),
    }),
  },
);
