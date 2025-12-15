export const GOAL_EXTRACTION_PROMPT = `Extract career goal from user's natural language description.

The goal describes what position/role the user wants to achieve.

GOAL STRUCTURE:
- position: target job titles (e.g., ["CTO", "VP Engineering"])
  - mode: "desired" (want these) or "undesired" (avoid these)
- countries: target countries (2-letter ISO codes, e.g., ["DE", "NL"])
  - mode: "desired" (want to work there) or "undesired" (want to avoid)
- domains: work domains (e.g., ["fintech", "ai", "saas"])
  - mode: "desired" or "undesired"
- skills: required skills (e.g., ["leadership", "team-building", "strategy"])
  - mode: "desired" or "undesired"
- languages: working languages (2-letter ISO codes, e.g., ["EN", "DE"])
  - mode: "desired" or "undesired"

EXTRACTION RULES:
- Position is usually the main thing user mentions (CTO, Manager, etc.)
- Countries: extract if user mentions geography preferences
- Domains: extract if user mentions industry or field preferences
- Skills: extract if user mentions what they want to learn or use
- Languages: extract if user mentions language requirements

MODE RULES:
- Default mode is "desired" unless user explicitly says "not", "avoid", "except"
- "anywhere except Russia" → countries: { mode: "undesired", values: ["RU"] }
- "want to work in Germany" → countries: { mode: "desired", values: ["DE"] }

Return only fields that can be extracted from user message.
If nothing specific mentioned, at least extract position.`;

export const USER_INTENT_PROMPT = `Classify user's intent from their response and extract optional filters.

Intent classification:
- PROCEED: User is ready to proceed, has decided, wants to move forward
- VALIDATE: User wants to validate/check goal, see who achieved it, see trajectories
  + Optional filters: excludedCreationReasons (array of strings), recencyThresholdMonths (number), limit (number)
- CLARIFY: User wants to add details, refine current goal, specify more
- SAVE: User confirms and wants to save the goal
- CHANGE: User wants to change goal to something completely different
- DELETE: User wants to delete goal and explore again
- FILTER: User wants to refine search results by excluding context fields, transition reasons, or adjusting parameters
  + Optional filters: excludedContextFields (array of strings), excludedCreationReasons (array of strings), recencyThresholdMonths (number), limit (number)
- CANCEL: User wants to cancel, stop, exit

Examples:
- "I've decided" → { intent: "proceed" }
- "yes, let's go" → { intent: "proceed" }
- "show me who achieved this" → { intent: "validate", filters: null }
- "validate without job changes" → { intent: "validate", filters: { excludedCreationReasons: ["company_changed", "position_changed"], recencyThresholdMonths: null, limit: null } }
- "show me last 12 months only" → { intent: "validate", filters: { excludedCreationReasons: null, recencyThresholdMonths: 12, limit: null } }
- "validate, limit 10 results" → { intent: "validate", filters: { excludedCreationReasons: null, recencyThresholdMonths: null, limit: 10 } }
- "add Germany to countries" → { intent: "clarify" }
- "looks good, save it" → { intent: "save" }
- "actually, I want to be a PM" → { intent: "change" }
- "delete my goal" → { intent: "delete" }
- "exclude industry" → { intent: "filter", filters: { excludedContextFields: ["industry"], excludedCreationReasons: null, recencyThresholdMonths: null, limit: null } }
- "filter without birthYear and cityName" → { intent: "filter", filters: { excludedContextFields: ["birthYear", "cityName"], excludedCreationReasons: null, recencyThresholdMonths: null, limit: null } }
- "no company changes" → { intent: "filter", filters: { excludedContextFields: null, excludedCreationReasons: ["company_changed"], recencyThresholdMonths: null, limit: null } }
- "cancel" → { intent: "cancel" }

Return: { intent, filters } where filters is null if not specified or intent is not "validate" or "filter"`;

export const GOAL_CLARIFICATION_PROMPT = `Update the existing goal based on user's clarification.

Current goal:
{currentGoal}

User wants to change/add:
{userMessage}

Apply the user's clarification to the current goal structure.
Preserve existing fields unless explicitly changed.
Return the complete updated goal.`;

export const ADHOC_CONTEXT_EXTRACTION_PROMPT = `Extract user's career context from their message for quick search.

This is NOT about what they WANT, but about what they HAVE now.

CONTEXT STRUCTURE:
- position: current job title (single string, e.g., "Backend Developer")
- company: current company name if mentioned
- domains: industry/field they work in (e.g., ["fintech", "saas"])
- skills: skills they have/use (e.g., ["typescript", "nodejs", "aws"])
- countries: where they work (2-letter ISO code, e.g., "DE")
- languages: languages they speak/use at work (2-letter ISO codes, e.g., ["EN", "DE"])
- yearsOfExperience: total years in career if mentioned

EXTRACTION RULES:
- Focus on CURRENT situation, not goals
- If user says "I'm a backend dev with 5 years experience in fintech"
  → position: "Backend Developer", yearsOfExperience: 5, domains: ["fintech"]
- Extract only what's explicitly stated
- Don't infer or guess missing information

Return null for fields not mentioned in the message.`;
