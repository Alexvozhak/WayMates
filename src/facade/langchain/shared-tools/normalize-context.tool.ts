import { tool } from "langchain";
import { z } from "zod";

import { adhocUserContextSchema } from "../../../shared/schemas.js";

import type { AdhocUserContext, UserId } from "../../../shared/schemas.js";
import type { Normalizer } from "../career-collector-agent.js";

// Helper to log normalization stats
function logNormalizationStats(original: AdhocUserContext, normalized: AdhocUserContext): void {
  console.log(`✅ Normalized: ${Object.keys(normalized).length} fields`);

  if (!original.skills || !normalized.skills) return;

  const unknownCount = original.skills.length - normalized.skills.length;
  if (unknownCount > 0) {
    console.log(`📝 Created ${unknownCount} unverified skill terms`);
  }
}

/**
 * Normalize a career context using MCP Normalizer.
 * Handles 2-tier normalization: exact match → fuzzy match → create unverified.
 * Atomic tool following ONE entity operation principle.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from tool() factory
export function createNormalizeContextTool(normalizer: Normalizer, userId: UserId) {
  return tool(
    async ({ context }: { context: AdhocUserContext }): Promise<AdhocUserContext> => {
      console.log(`🔧 normalize_context called for position: ${context.position}`);

      try {
        // Use MCP Normalizer for 2-tier normalization
        // This will silently create unverified terms for unknown skills
        const normalized = await normalizer.normalizeUserContext(context, userId);

        logNormalizationStats(context, normalized);

        return normalized;
      } catch (error) {
        console.error("Failed to normalize context:", error);
        // Return original context if normalization fails
        return context;
      }
    },
    {
      name: "normalize_context",
      description:
        "Normalize a career context (position, skills, domains) using dictionary matching",
      schema: z.object({
        context: adhocUserContextSchema.describe("Career context to normalize"),
      }),
    },
  );
}
