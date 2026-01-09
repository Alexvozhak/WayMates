/**
 * Builds trail extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildTrailExtractionPrompt(hints: string): string {
  return `Extract learning trail information from the user's message.

KNOWN VALUES (CAREFULLY check these lists):
{{
${hints}
}}

Required fields:
- skill: Map to {{KNOWN SKILLS}} from hints above
- platform: The learning platform (coursera, udemy, youtube, self-study, bootcamp, university, etc.)

Optional fields (extract if mentioned, otherwise leave as null):
- totalDurationWeeks: Duration in weeks
- schedule: { sessionsPerWeek, hoursPerSession }
- costUsd: Cost in USD
- courseName: Name of the course (lowercase-kebab-case)
- courseLink: URL of the course
- ratingCourse/ratingPlatform/ratingSchedule: 1-5 ratings
- userFeedback: User's feedback about the course

Return JSON with extracted information. Use null for unknown optional fields.`;
}

export const TRAIL_EDIT_PROMPT = `Edit the trail based on user corrections.

Apply the user's requested changes to the current trail data.
Preserve all unchanged fields.

Return the complete updated trail JSON.`;
