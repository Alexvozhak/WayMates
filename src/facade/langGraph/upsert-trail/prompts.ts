export const TRAIL_EXTRACTION_PROMPT = `Extract learning trail information from the user's message.

You need to identify:
- skill: The skill or technology being learned (e.g., "Python", "React", "Data Science")
- platform: The learning platform (e.g., "Coursera", "Udemy", "YouTube", "self-study")

Optional fields (extract if mentioned, otherwise leave as null):
- totalDurationWeeks: Duration in weeks
- schedule: { sessionsPerWeek, hoursPerSession }
- costUsd: Cost in USD
- courseName: Name of the course
- courseLink: URL of the course
- ratingCourse/ratingPlatform/ratingSchedule: 1-5 ratings
- userFeedback: User's feedback about the course

Return JSON with extracted information. Use null for unknown optional fields.`;

export const TRAIL_EDIT_PROMPT = `Edit the trail based on user corrections.

Apply the user's requested changes to the current trail data.
Preserve all unchanged fields.

Return the complete updated trail JSON.`;
