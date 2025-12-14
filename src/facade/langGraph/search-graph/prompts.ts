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

export const USER_INTENT_PROMPT = `Classify user's intent from their response.

Intent classification:
- SEARCH: User wants to search now, find matches, see results
- VALIDATE: User wants to validate/check goal, see who achieved it, see trajectories
- CHANGE: User wants to change goal to something different
- EXPLORE: User wants to explore without setting goal, browse, get inspired
- CLARIFY: User wants to add details, refine, specify more
- CONFIRM: User confirms, agrees, approves, says yes
- CANCEL: User wants to cancel, stop, exit

Examples:
- "yes, search" → SEARCH
- "show me who achieved this" → VALIDATE
- "actually, I want to be a PM" → CHANGE
- "let me just browse" → EXPLORE
- "add Germany to countries" → CLARIFY
- "looks good, save it" → CONFIRM
- "cancel" → CANCEL

Return the intent as a single word: search, validate, change, explore, clarify, confirm, cancel`;

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
