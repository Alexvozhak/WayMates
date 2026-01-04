import { HumanMessage } from "@langchain/core/messages";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { logger } from "../../logger.js";
import { withReasoning } from "../../utils/llm-schemas.js";

import { extractableContextSchema } from "./extraction-models.js";
import { getModel } from "./models.js";

import type { ExtractableContext } from "./extraction-models.js";

const contextExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what career context you extracted and why"),
);

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
  async ({ text }: { text: string }): Promise<ExtractableContext | null> => {
    const prompt = `Extract ONE career position from the following text.

TEXT:
${text}

═══════════════════════════════════════════════════
REQUIRED FIELDS:
═══════════════════════════════════════════════════
- position: Job title
- domains: Work areas (min 1)
- skills: Technical/professional skills (min 1)
- industry: Company's industry
- companySize: Approximate size (startup, 50-200, 1000+)
- countryCode: ISO 3166-1 alpha-2 code
- cityName: City name
- citizenships: Citizenship codes
- birthYear: Year of birth
- creationReason: Why job started (started_working, changed_company, got_promoted, etc.)

═══════════════════════════════════════════════════
OPTIONAL FIELDS:
═══════════════════════════════════════════════════
- educationLevel, salaryExact/salaryMin/salaryMax (USD), languages, feedback

If multiple positions present, extract FIRST one only.
Return null if no career position found.`;

    try {
      const { reasoning, ...extracted } = await contextExtractionModel.invoke([new HumanMessage(prompt)]);
      logger.info({ reasoning }, "single context extraction reasoning");

      if (!extracted) {
        return null;
      }

      // Generate contextId for extracted context
      // withStructuredOutput guarantees typed ExtractableContext
      return {
        ...extracted,
        contextId: `ctx_${uuidv7()}`,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to extract single context");
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
