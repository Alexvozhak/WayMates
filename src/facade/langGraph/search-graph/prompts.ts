export type GoalExtractionDictionaries = {
  positions: string[];
  domains: string[];
  skills: string[];
  industries: string[];
};

/**
 * Builds goal extraction prompt with injected dictionaries.
 * Dictionaries are loaded from Neo4j to help LLM map user input to canonical values.
 */
export function buildGoalExtractionPrompt(dicts: GoalExtractionDictionaries): string {
  const hints: string[] = [];
  if (dicts.positions.length > 0) hints.push(`KNOWN POSITIONS: ${dicts.positions.join(", ")}`);
  if (dicts.domains.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domains.join(", ")}`);
  if (dicts.industries.length > 0) hints.push(`KNOWN INDUSTRIES: ${dicts.industries.join(", ")}`);
  if (dicts.skills.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skills.join(", ")}`);

  const dictsSection = hints.length > 0 ? `\n${hints.join("\n")}\n` : "";

  return `Extract career goal from user's natural language description.
Response may be in any language.

The goal describes what position/role the user wants to achieve.
${dictsSection}
GOAL STRUCTURE:
- position: target seniority/role level from KNOWN POSITIONS
  - mode: "desired" (want these) or "undesired" (avoid these)
- countries: target countries (2-letter ISO codes)
  - mode: "desired" (want to work there) or "undesired" (want to avoid)
- domains: work domains/technical areas from KNOWN DOMAINS
  - mode: "desired" or "undesired"
- skills: required skills from KNOWN SKILLS
  - mode: "desired" or "undesired"
- languages: working languages (2-letter ISO codes)
  - mode: "desired" or "undesired"

EXTRACTION RULES:
- Position: find the best semantic match from KNOWN POSITIONS for the role user describes
- Domains: find the best semantic match from KNOWN DOMAINS for the field/industry user mentions
- Skills: find the best semantic match from KNOWN SKILLS for capabilities user mentions
- Countries: extract if user mentions geography preferences
- Languages: extract if user mentions language requirements

MODE RULES:
- Default mode is "desired" unless user explicitly says "not", "avoid", "except"
- "anywhere except Russia" → countries: { mode: "undesired", values: ["RU"] }
- "want to work in Germany" → countries: { mode: "desired", values: ["DE"] }

Return only fields that can be extracted from user message.
If nothing specific mentioned, at least extract position.`;
}

export const USER_INTENT_PROMPT = `Classify user's intent. Response may be in any language.

Intents:
- PROCEED: User expresses a career goal, states what position/role they want, confirms readiness to move forward, or agrees
- VALIDATE: User wants to see real people who achieved similar goals, check trajectories, validate feasibility
  + filters: { excludedCreationReasons, recencyThresholdMonths, limit } or null
- CLARIFY: User adds details or refines the current goal (countries, skills, domains)
  + clarificationText: user's full message
- SAVE: User explicitly confirms saving the goal
- CHANGE: User wants to completely change the goal to something different (not add details)
- DELETE: User wants to delete the goal and start over
- FILTER: User wants to refine search parameters (exclude fields, reasons, adjust limits)
  + filters: { excludedContextFields, excludedCreationReasons, recencyThresholdMonths, limit } or null
- CANCEL: User explicitly wants to stop, cancel, or exit
- UNKNOWN: Message is unrelated, unclear, or gibberish

Return: { intent, clarificationText (for clarify), filters (for validate/filter) }`;

export const GOAL_CLARIFICATION_PROMPT = `Update the existing goal based on user's clarification.

Current goal:
{currentGoal}

User wants to change/add:
{userMessage}

IMPORTANT MERGE RULES:
1. If user mentions a field → update it with the new value
2. If user does NOT mention a field → KEEP the existing value (copy from current goal)
3. NEVER return null for fields that exist in current goal
4. Return the COMPLETE goal with ALL fields from current goal

Example:
Current: { position: ["PM"] }
User: "add Germany"
Result: { position: ["PM"], countries: ["DE"] }  // position PRESERVED + countries ADDED`;

export type AdhocExtractionDictionaries = {
  positions: string[];
  domains: string[];
  skills: string[];
};

/**
 * Builds adhoc context extraction prompt with injected dictionaries.
 * Dictionaries help LLM map user input to canonical values.
 */
export function buildAdhocExtractionPrompt(dicts: AdhocExtractionDictionaries): string {
  const hints: string[] = [];
  if (dicts.positions.length > 0) hints.push(`KNOWN POSITIONS (seniority levels): ${dicts.positions.join(", ")}`);
  if (dicts.domains.length > 0) hints.push(`KNOWN DOMAINS: ${dicts.domains.join(", ")}`);
  if (dicts.skills.length > 0) hints.push(`KNOWN SKILLS: ${dicts.skills.join(", ")}`);

  const dictsSection = hints.length > 0 ? `\n${hints.join("\n")}\n` : "";

  return `Extract user's CURRENT career context from their message. Response may be in any language.

This is NOT about what they WANT, but about what they HAVE now.
${dictsSection}
CONTEXT STRUCTURE:
- position: seniority/role level (find best semantic match from KNOWN POSITIONS)
- company: current company name if mentioned
- domains: work field/industry (find best semantic match from KNOWN DOMAINS)
- skills: technical skills (find best semantic match from KNOWN SKILLS)
- countryCode: where they work (2-letter ISO code)
- languages: languages they speak/use at work (2-letter ISO codes)
- yearsOfExperience: total years in career if mentioned

EXTRACTION RULES:
- Focus on CURRENT situation, not goals
- Find the best semantic match from dictionaries for position, domains, skills
- Extract only what's explicitly stated
- Don't infer or guess missing information

Return null for fields not mentioned in the message.`;
}
