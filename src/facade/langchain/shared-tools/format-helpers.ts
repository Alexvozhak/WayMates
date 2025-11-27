import type { Trail, UserContext } from "../../../shared/schemas.js";

/**
 * Format clarification questions as numbered list for user-friendly display.
 * Used by askClarificationTool and any calling tool that needs to format questions.
 */
export function formatQuestions(questions: string[]): string {
  return `I need some additional information to complete your career profile:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPlease provide answers to these questions.`;
}

/**
 * Format skills array as preview line with "more" indicator.
 * Shows first 5 skills and indicates remaining count.
 */
export function formatSkills(skills: string[] | undefined): string {
  if (!skills || skills.length === 0) return "";
  const preview = skills.slice(0, 5).join(", ");
  const more = skills.length > 5 ? ` +${skills.length - 5} more` : "";
  return `\n   Skills: ${preview}${more}`;
}

/**
 * Format single context for preview display.
 * Shows position, industry, location, and skills summary.
 */
export function formatContext(ctx: UserContext, index: number): string {
  const parts = [];
  if (ctx.position) parts.push(`**${ctx.position}**`);
  if (ctx.industry) parts.push(`in ${ctx.industry}`);
  if (ctx.cityName && ctx.countryCode) parts.push(`(${ctx.cityName}, ${ctx.countryCode})`);

  return `${index + 1}. ${parts.join(" ")}${formatSkills(ctx.skills)}`;
}

/**
 * Format career data preview with contexts and trails for user confirmation.
 * Used by confirmCareerDataTool and handleValidationSuccess.
 */
export function formatPreview(contexts: UserContext[], trails: Trail[]): string {
  const contextsPreview = contexts.map((ctx, i) => formatContext(ctx, i)).join("\n");

  const trailsPreview =
    trails.length > 0
      ? "\n\n**Transitions:**\n" +
        trails
          .map((t, i) => {
            const parts = [];
            if (t.skill) parts.push(`Skill: ${t.skill}`);
            if (t.courseName) parts.push(`Course: ${t.courseName}`);
            if (t.platform) parts.push(`via ${t.platform}`);
            return `${i + 1}. ${parts.join(" - ")}`;
          })
          .join("\n")
      : "";

  return `Here's what I've extracted from your career history:\n\n**Positions:**\n${contextsPreview}${trailsPreview}\n\nIs this information correct? Reply "yes" to save, or let me know what needs to be changed.`;
}
