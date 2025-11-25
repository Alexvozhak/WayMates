import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchema } from "../../../shared/schemas.js";

import type { Trail, UserContext } from "../../../shared/schemas.js";

/**
 * Show extracted career data for user confirmation.
 * Updates state to awaiting_confirmation and includes formatted preview.
 */
// Helper function to format a single context
function formatContext(ctx: UserContext, index: number): string {
  const parts = [];
  if (ctx.position) parts.push(`**${ctx.position}**`);
  if (ctx.industry) parts.push(`in ${ctx.industry}`);
  if (ctx.cityName && ctx.countryCode) {
    parts.push(`(${ctx.cityName}, ${ctx.countryCode})`);
  }

  const skills = formatSkills(ctx.skills);
  if (skills) parts.push(skills);

  return `${index + 1}. ${parts.join(" ")}`;
}

// Helper function to format skills
function formatSkills(skills?: string[]): string {
  if (!skills || skills.length === 0) return "";
  const preview = skills.slice(0, 5).join(", ");
  const more = skills.length > 5 ? ` +${skills.length - 5} more` : "";
  return `\n   Skills: ${preview}${more}`;
}

// Helper function to format a single trail
function formatTrail(trail: Trail, index: number): string {
  const parts = [];
  if (trail.skill) parts.push(`Skill: ${trail.skill}`);
  if (trail.courseName) parts.push(`Course: ${trail.courseName}`);
  if (trail.platform) parts.push(`via ${trail.platform}`);
  if (trail.totalDurationWeeks) parts.push(`${trail.totalDurationWeeks} weeks`);
  return `${index + 1}. ${parts.join(" - ")}`;
}

export const confirmDataTool = tool(
  ({ contexts, trails }: { contexts: UserContext[]; trails: Trail[] }) => {
    console.log(`🔧 confirm_data called: ${contexts.length} contexts, ${trails.length} trails`);

    // Format contexts for display
    const contextsPreview = contexts.map((ctx, i) => formatContext(ctx, i)).join("\n");

    // Format trails for display
    const trailsPreview =
      trails.length > 0
        ? "\n\n**Transitions:**\n" + trails.map((trail, i) => formatTrail(trail, i)).join("\n")
        : "";

    const message = `**Extracted Career Data:**\n\n**Positions:**\n${contextsPreview}${trailsPreview}\n\nIs this correct? Reply "yes" to confirm or provide corrections.`;

    return new Command({
      update: {
        status: "awaiting_confirmation",
        contexts,
        trails,
        message,
      },
    });
  },
  {
    name: "confirm_data",
    description: "Show extracted career data for user confirmation",
    schema: z.object({
      contexts: z.array(userContextSchema).describe("Array of normalized career contexts"),
      trails: z.array(trailSchema).describe("Array of career transitions"),
    }),
  },
);
