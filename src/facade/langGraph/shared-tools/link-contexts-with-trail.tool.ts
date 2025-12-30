import { HumanMessage } from "@langchain/core/messages";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";
import { logger } from "../../logger.js";
import { withReasoning } from "../../utils/llm-schemas.js";

import { getModel } from "./models.js";

import type { Trail, UserContext } from "../../../shared/schemas.js";

const linkTrailSchema = trailSchema.omit({
  fromContextId: true,
  toContextId: true,
});

const linkModel = getModel("extraction").withStructuredOutput(
  withReasoning(linkTrailSchema, "Explain what transition you identified between these positions")
);

/**
 * Link TWO contexts with a trail (transition) between them.
 * Atomic tool following TWO entities → ONE link principle.
 */
// Helper to format context for prompt
function formatContextForPrompt(ctx: UserContext, label: string): string {
  const position = ctx.position || "unknown position";
  const industry = ctx.industry || "unknown industry";
  const skills = ctx.skills?.join(", ") || "not specified";
  const location = ctx.cityName && ctx.countryCode ? `${ctx.cityName}, ${ctx.countryCode}` : "location not specified";

  return `${label}: ${position} in ${industry}
Skills: ${skills}
Location: ${location}`;
}

// Helper to build the transition prompt
function buildTransitionPrompt(fromContext: UserContext, toContext: UserContext, text?: string): string {
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
      logger.warn("Cannot link contexts without IDs");
      return null;
    }

    const prompt = buildTransitionPrompt(fromContext, toContext, text);

    try {
      const { reasoning, ...extracted } = await linkModel.invoke([new HumanMessage(prompt)]);
      logger.info({ reasoning }, "link trail extraction reasoning");

      if (!extracted) {
        return null;
      }

      // Type narrowing after validation (checked on line 77)
      const fromId: string = fromContext.contextId;
      const toId: string = toContext.contextId;

      return trailSchema.parse({
        ...extracted,
        fromContextId: fromId,
        toContextId: toId,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to link contexts with trail");
      return null;
    }
  },
  {
    name: "link_contexts_with_trail",
    description: "Link TWO career contexts with a trail (transition) between them",
    schema: z.object({
      fromContext: userContextSchemaBase.describe("The starting career position"),
      toContext: userContextSchemaBase.describe("The target career position"),
      text: z.string().nullable().describe("Additional text describing the transition"),
    }),
  },
);
