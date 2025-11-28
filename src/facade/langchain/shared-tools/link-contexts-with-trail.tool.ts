import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";
import { config } from "../../env.js";

import type { Trail, UserContext } from "../../../shared/schemas.js";

// For linking, we extract trail data (context IDs will be added from parameters)
const linkTrailSchema = trailSchema.omit({
  fromContextId: true,
  toContextId: true,
});

// Model with structured output for guaranteed JSON
const extractionModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(linkTrailSchema);

/**
 * Link TWO contexts with a trail (transition) between them.
 * Atomic tool following TWO entities → ONE link principle.
 */
// Helper to format context for prompt
function formatContextForPrompt(ctx: UserContext, label: string): string {
  const position = ctx.position || "unknown position";
  const industry = ctx.industry || "unknown industry";
  const skills = ctx.skills?.join(", ") || "not specified";
  const location =
    ctx.cityName && ctx.countryCode
      ? `${ctx.cityName}, ${ctx.countryCode}`
      : "location not specified";

  return `${label}: ${position} in ${industry}
Skills: ${skills}
Location: ${location}`;
}

// Helper to build the transition prompt
function buildTransitionPrompt(
  fromContext: UserContext,
  toContext: UserContext,
  text?: string,
): string {
  const fromText = formatContextForPrompt(fromContext, "FROM");
  const toText = formatContextForPrompt(toContext, "TO");
  const additional = text ? `\nAdditional context:\n${text}` : "";

  return `Analyze the career transition between these two positions:

${fromText}

${toText}
${additional}

Extract the trail (transition) between these positions:
- What was the reason for this career change?
- Were any courses or certifications completed?
- What platform was used for learning (if any)?
- What new skills were developed during the transition?
- How long did the transition take (in months)?

Return null if no clear transition pattern can be identified.`;
}

export const linkContextsWithTrailTool = tool(
  async ({
    fromContext,
    toContext,
    text,
  }: {
    fromContext: UserContext;
    toContext: UserContext;
    text?: string;
  }): Promise<Trail | null> => {
    // CRITICAL: Validate contextIds BEFORE extraction to prevent waste
    if (!fromContext.contextId || !toContext.contextId) {
      console.warn("Cannot link contexts without IDs");
      return null;
    }

    console.log(`🔧 link_contexts_with_trail: ${fromContext.position} → ${toContext.position}`);

    const prompt = buildTransitionPrompt(fromContext, toContext, text);

    try {
      const extracted = await extractionModel.invoke([new HumanMessage(prompt)]);

      if (!extracted) {
        return null;
      }

      // Type narrowing after validation (checked on line 77)
      const fromId: string = fromContext.contextId;
      const toId: string = toContext.contextId;

      return {
        ...extracted,
        fromContextId: fromId,
        toContextId: toId,
      };
    } catch (error) {
      console.error("Failed to link contexts with trail:", error);
      return null;
    }
  },
  {
    name: "link_contexts_with_trail",
    description: "Link TWO career contexts with a trail (transition) between them",
    schema: z.object({
      fromContext: userContextSchemaBase.describe("The starting career position"),
      toContext: userContextSchemaBase.describe("The target career position"),
      text: z.string().optional().describe("Additional text describing the transition"),
    }),
  },
);
