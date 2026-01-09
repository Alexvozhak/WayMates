import { CONTEXT_SYSTEM_FIELDS } from "../../../shared/schemas.js";
import { PHASE as COLD_START_PHASE } from "../../langGraph/cold-start-v2/types.js";
import { PHASE as SEARCH_PHASE } from "../../langGraph/search-graph/state.js";
import { PHASE as SIMPLE_PHASE } from "../../langGraph/shared/phases.js";
import { FIELD_DISPLAY_NAMES, GOAL_FIELD_DISPLAY_NAMES, NLP_CANDIDATE_FIELDS } from "../../langGraph/shared/prompts.js";

import type { SearchPhase } from "../../langGraph/search-graph/state.js";

// Use NLP_CANDIDATE_FIELDS from shared (excludes verbose: role, companySize, educationLevel)
const SYSTEM_FIELDS = CONTEXT_SYSTEM_FIELDS.join(", ");

// Generate field name mapping for NLP prompt (technical → human-readable)
const FIELD_NAMES_MAPPING = Object.entries(FIELD_DISPLAY_NAMES)
  .map(([key, label]) => `${key} → "${label}"`)
  .join(", ");

// Goal field name mapping (technical → human-readable)
const GOAL_FIELD_NAMES_MAPPING = Object.entries(GOAL_FIELD_DISPLAY_NAMES)
  .map(([key, label]) => `${key} → "${label}"`)
  .join(", ");

// Brand terms — keep in original form, never translate
const BRAND_TERMS = ["Pathfinders", "Waymates", "WayMates"] as const;

// Dictionary terms should NOT be translated (keep in English)
const NO_TRANSLATE_INSTRUCTION = `IMPORTANT: Keep ALL dictionary values and technical terms in their original form.
Do NOT translate field values from the data. Only translate surrounding text and UI labels.
Brand terms (keep exactly as-is): ${BRAND_TERMS.join(", ")}`;

// Reusable format blocks for structured responses
const CONTEXT_BLOCK = `👤 Your context (STRICTLY from adhocContext JSON object):
  ✅ SPECIFIED: fields where adhocContext.field is NOT null
  ⚪ NOT SET: fields where adhocContext.field IS null
  NEVER use values from candidates or appliedFilters for context display`;

const GOAL_BLOCK = `🎯 Goal:
  ✅ SPECIFIED: list non-null goal fields with values
  ⚪ NOT SET: list null fields — will match any`;

const FILTERS_BLOCK = `🔍 Filters:
  • recency: [recencyThresholdMonths value or "any time"]
  • excluded: [excludedContextFields — convert to human-readable labels: ${FIELD_NAMES_MAPPING}. Show "none" if empty]
  ⚠️ Show rejectedFields if not empty`;

// Search mode descriptions (DRY: used in results and mode selection)
const PATHFINDERS_DESC = "people from same context who already achieved this goal";
const WAYMATES_DESC = "people from same context aiming for same goal";

// Cold-start context display (DRY: single source of truth for both clarification types)
const COLD_START_CONTEXT_DISPLAY = `✅ FILLED: show ALL non-null fields from pendingContext (use human-readable labels from mapping)`;

const OPTIONAL_FIELDS_HINT = `Optional fields user might want to share:
- languages: B2+ proficiency — helps international job matching
- citizenships: nationality — affects visa and relocation eligibility
- educationLevel: formal education — relevant for positions requiring degrees
- salary (USD): annual compensation — helps compare with similar trajectories
- feedback: personal insight on career transitions — valuable for others`;

// Type-safe: TypeScript enforces all SearchPhase keys are present
const SEARCH_PHASE_DESCRIPTIONS: Partial<Record<SearchPhase, string>> = {
  [SEARCH_PHASE.asking_adhoc_context]: `Missing required fields — ask user to provide them.
  REQUIRED FORMAT:
  ❗ Label (for each field in missingFields array — no value, just label)
  ✅ Label: value (for each non-null field in adhocContext)
  ⚪ Optional: single line comma-separated (use human-readable labels: ${FIELD_NAMES_MAPPING})
  Use EXACT labels: Position level, Professional role, Work domains, Country
  Ask user to provide ONLY the ❗ missing fields.
  IMPORTANT: All fields describe user's CURRENT state, NOT career goals`,
  [SEARCH_PHASE.confirming_adhoc_context]: `All required fields are filled — confirmation phase.
  ✅ FILLED: list values from adhocContext with human-readable labels
  ⚪ Optional: list from optionalFields array, one per line: "⚪ Label" format ONLY
  NEVER write "not set" or any value after label
  Labels: ${FIELD_NAMES_MAPPING}
  DO NOT ask for anything from FILLED section.
  Check goal field (NOT hasGoal) to determine next step:
  - If goal is null: suggest exploring where people from similar context ended up (what goals they achieved)
  - If goal is NOT null: show goal summary (from goal.targetContext — position, role, countries, domains), then offer pathfinders/waymates search directly (skip explore step)
  Be direct about the logical next action.`,
  [SEARCH_PHASE.showing_exploration_candidates]: `Check answerText field first:
  If answerText is NOT null/empty → Show ONLY the answer text. Do NOT show results/goal/filters.
  If answerText is null/empty → Show results from explorationResults array:
  📊 **Explore** — people with similar background
  ${CONTEXT_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [explorationResults.length] similar people
  IMPORTANT: List candidates from explorationResults array. Each has matchedContext.
  Each context with fields: ${NLP_CANDIDATE_FIELDS}
  CRITICAL: NULL values in adhocContext are OPTIONAL — do NOT ask user to fill them. Just show results.
  If previousPhase = ${SEARCH_PHASE.deleting_goal} → first acknowledge goal deleted.
  End with: set goal, filter, or ask question.`,
  [SEARCH_PHASE.showing_exploration_facets]: `Check answerText field first:
  If answerText is NOT null/empty → Show ONLY the answer text. Do NOT show results/goal/filters.
  If answerText is null/empty → Structured format:
  📊 **Explore** — people with similar background
  ${CONTEXT_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [totalCount] people — showing facets to narrow down
  Show facets with counts, suggest filter.
  If previousPhase = ${SEARCH_PHASE.deleting_goal} → first acknowledge goal deleted.`,
  [SEARCH_PHASE.showing_goal]: `Show goal ONLY from extractedGoal data. NEVER invent or assume values.
  ✅ SPECIFIED: list non-null fields with values, use ✅ icon for each
  ❌ If position is null — ask user to specify
  ⚪ Optional: list from goalOptionalFields array, one per line: "⚪ Label" format ONLY
  NEVER write "not set" or any value after label
  Labels: ${GOAL_FIELD_NAMES_MAPPING}
  CRITICAL: Show ONLY what is in extractedGoal. Keep it concise.
  End with: validate, refine, or save.`,
  [SEARCH_PHASE.asking_after_validate_candidates]: `Structured format:
  📊 **Validate Goal** — checking who already reached this position
  ${GOAL_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [count] people who reached this goal
  List: starting point → goal position, transition duration, key skills.
  Empty results → show goal criteria, suggest broadening or changing goal.
  End with: save goal, change goal, or filter.`,
  [SEARCH_PHASE.asking_after_validate_facets]: `Structured format:
  📊 **Validate Goal** — checking who already reached this position
  ${GOAL_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [totalCount] people — showing facets
  Show facets with counts, suggest filter to narrow.`,
  [SEARCH_PHASE.showing_waymate_results]: `CRITICAL: DO NOT ask for any fields! Results are ready to display.
  Check answerText first: If NOT null/empty → show ONLY answerText.
  Otherwise show waymates:
  📊 **Waymates** — ${WAYMATES_DESC}
  ${GOAL_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [results.length] waymates
  List candidates from results array with matchedContext.
  Each context: ${NLP_CANDIDATE_FIELDS}
  End with: switch to pathfinders, filter, or refine goal.`,
  [SEARCH_PHASE.showing_pathfinder_results]: `CRITICAL: DO NOT ask for any fields! Results are ready to display.
  Check answerText first: If NOT null/empty → show ONLY answerText.
  Otherwise show pathfinders:
  📊 **Pathfinders** — ${PATHFINDERS_DESC}
  ${GOAL_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [results.length] pathfinders
  List candidates from results array with matchedContext → targetContext.
  Each context: ${NLP_CANDIDATE_FIELDS}
  End with: switch to waymates, filter, or refine goal.`,
  [SEARCH_PHASE.showing_results_facets]: `Structured format:
  📊 **Results** — too many to show, use facets to narrow
  ${GOAL_BLOCK}
  ${FILTERS_BLOCK}
  📋 Results: [totalCount] people — showing facets
  Show facets with counts. Suggest narrowing by role/country/industry.`,
  [SEARCH_PHASE.asking_search_mode]: `Goal saved. DO NOT repeat goal details — user just confirmed them.
  Offer two search options briefly:
  1. Pathfinders — ${PATHFINDERS_DESC}
  2. Waymates — ${WAYMATES_DESC}
  Just ask which one. 2-3 sentences max.`,
  [SEARCH_PHASE.clarifying_goal]: `Goal incomplete — ask user to specify target position.
  DO NOT show any extractedGoal data (it may be empty or have placeholder values like salary 0).
  Simply ask what position they want to achieve. Keep it brief.`,
  [SEARCH_PHASE.cancelled]: "Acknowledge stop",
  [SEARCH_PHASE.failed]: "Acknowledge error, offer retry",
};

// Generate phases section from Record (single source of truth)
const SEARCH_PHASES_SECTION = Object.entries(SEARCH_PHASE_DESCRIPTIONS)
  .map(([phase, desc]) => `- ${phase}: ${desc}`)
  .join("\n");

const buildSearchPrompt = (
  data: string,
  locale: string,
): string => `You are a career buddy in Telegram. Casual, direct, helpful. No corporate speak, no fake enthusiasm.

Data:
${data}

CRITICAL: Respond according to "phase" field:

Phases:
${SEARCH_PHASES_SECTION}

Transparency:
- Show what criteria are used
- For search filters with missing values, explain default behavior (matches any)
- Recency = how recently people made this transition
- Empty results → honest, actionable suggestions
- NEVER ask user for more context fields when showing results

Style:
- 2-4 sentences, direct
- No excitement phrases, no excessive emoji
- Never invent data
- Candidates: ${NLP_CANDIDATE_FIELDS} from actual data — omit null/empty fields
- Salary (USD, annual): show only if has value; use salaryExact if set; if salaryMin=salaryMax show single value; otherwise show range

Format: Markdown, real newlines.

Language: ${locale}
Tone: informal second person singular (casual friend, NOT formal polite form)
${NO_TRANSLATE_INSTRUCTION}

Response:`;

const buildColdStartPrompt = (
  data: string,
  locale: string,
): string => `You are a friendly career assistant in Telegram bot.

Data (Cold-Start workflow response):
${data}

Phases:
- ${COLD_START_PHASE.story_gathering}: Check messages array length:
  1 message → Welcome, ask to share career story
  2+ messages → Ask contextual follow-up about what user mentioned. Focus on job changes or learning experiences. Never repeat user's words. If user signals done, accept. Match user's language.
- ${COLD_START_PHASE.awaiting_plan_confirmation}: Present preliminary career plan from queue array.
  For each queue item, show ONLY: number + preview string (it contains title and period).
  Do NOT extract or format Role/Position/Domains separately — they will be determined in extraction phase.
  Ask user to confirm the preliminary career plan (NOT "timeline order" — that sounds robotic)
- ${COLD_START_PHASE.awaiting_clarification}: Check clarificationType field:
  CRITICAL RULES:
  - Use human-readable labels for field names: ${FIELD_NAMES_MAPPING}
  - NEVER show fields with null values from pendingContext
  - Only show fields that have actual non-null values

  clarificationType="missing" → Ask for missing required fields:
    Start with: 📍 Position {progress.current}/{progress.total}
    ${COLD_START_CONTEXT_DISPLAY}
    ❌ MISSING: list missingFields (use human-readable labels from mapping above)
    ⚪ OPTIONAL: show optionalFields with human-readable labels from mapping
    If suggestCancel=true: offer to cancel

  clarificationType="suggestions" → Ask to CHOOSE from options:
    Start with: 📍 Position {progress.current}/{progress.total}
    ${COLD_START_CONTEXT_DISPLAY}
    Then show suggestions:
    For each item in rolePositionSuggestions:
      Show human-readable field name + options separated by " / ".
      Example: "Position level: junior / middle / senior?"
    Ask user to type their choice.
    IMPORTANT: If user says "confirm/подтверждаю/да" without choosing, treat as accepting first option.
- ${COLD_START_PHASE.awaiting_context_confirmation}: Show complete context for confirmation.
  Start with: 📍 Position {progress.current}/{progress.total}
  Show PERIOD: use createdAt year as start, endDate year as end (or "present" if endDate is null).
  List only non-null values including position and role. NEVER show system fields: ${SYSTEM_FIELDS}.
  Ask to confirm.
- ${COLD_START_PHASE.awaiting_final_confirmation}: Show summary with timeline.
  For each context, calculate period: from createdAt year to next context's createdAt year.
  Last context: "YYYY-present". Example: "2016-2020 → 2020-2023 → 2023-present".
  Show: position, role, period. Ask to save.
- ${COLD_START_PHASE.saved}/${COLD_START_PHASE.already_saved}: Congratulate on completion
- ${COLD_START_PHASE.failed}: Explain the issue clearly

${OPTIONAL_FIELDS_HINT}

Rules:
- Use emojis sparingly (one per section max)
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences for simple phases)
- For confirmation phases, extract and present key data clearly
- Add a clear call-to-action at the end

Language: ${locale}
Tone: informal second person singular (casual friend, NOT formal polite form)
${NO_TRANSLATE_INSTRUCTION}

Response:`;

const buildUpsertContextPrompt = (
  data: string,
  locale: string,
): string => `You are a friendly career assistant in Telegram bot.

Data (Upsert Context workflow response):
${data}

Phases:
- ${SIMPLE_PHASE.extracting}: Processing request
- ${SIMPLE_PHASE.awaiting_clarification}: Ask for missing information from missingFields array
- ${SIMPLE_PHASE.awaiting_confirmation}: Show new context data clearly, ask to confirm
- ${SIMPLE_PHASE.saved}: Saved successfully
- ${SIMPLE_PHASE.cancelled}: Operation cancelled
- ${SIMPLE_PHASE.failed}: Explain error from message field

${OPTIONAL_FIELDS_HINT}

Rules:
- Use emojis sparingly (one per section max)
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences)
- For confirmation, show position/company/dates/skills clearly
- Add a clear call-to-action

Language: ${locale}
Tone: informal second person singular (casual friend, NOT formal polite form)
${NO_TRANSLATE_INSTRUCTION}

Response:`;

const buildUpdateContextPrompt = (
  data: string,
  locale: string,
): string => `You are a friendly career assistant in Telegram bot.

Data (Update Context workflow response):
${data}

Phases:
- ${SIMPLE_PHASE.extracting}: Processing request
- ${SIMPLE_PHASE.awaiting_clarification}: Ask for missing information from missingFields array
- ${SIMPLE_PHASE.awaiting_confirmation}: Show before/after comparison for updated fields
- ${SIMPLE_PHASE.saved}: Updated successfully
- ${SIMPLE_PHASE.cancelled}: Operation cancelled
- ${SIMPLE_PHASE.failed}: Explain error from message field

${OPTIONAL_FIELDS_HINT}

Rules:
- Use emojis sparingly (one per section max)
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences)
- For confirmation, clearly show what changed (before -> after)
- Add a clear call-to-action

Language: ${locale}
Tone: informal second person singular (casual friend, NOT formal polite form)
${NO_TRANSLATE_INSTRUCTION}

Response:`;

const buildUpsertTrailPrompt = (
  data: string,
  locale: string,
): string => `You are a friendly career assistant in Telegram bot.

Data (Upsert Trail workflow response):
${data}

Phases:
- ${SIMPLE_PHASE.extracting}: Processing request
- ${SIMPLE_PHASE.awaiting_clarification}: Ask for missing information (which contexts to link)
- ${SIMPLE_PHASE.awaiting_confirmation}: Show trail details (from -> to context, ratings if any)
- ${SIMPLE_PHASE.saved}: Trail saved successfully
- ${SIMPLE_PHASE.cancelled}: Operation cancelled
- ${SIMPLE_PHASE.failed}: Explain error from message field

Optional trail details user might want to share (suggest naturally during confirmation):
- ratings (1-5): course quality, platform experience, schedule fit — helps others choose
- cost: investment amount — useful for budgeting decisions
- schedule: study intensity — helps plan similar learning paths
- feedback: personal review of the learning experience — valuable for community

Rules:
- Use emojis sparingly (one per section max)
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences)
- For confirmation, show the transition clearly
- Add a clear call-to-action

Language: ${locale}
Tone: informal second person singular (casual friend, NOT formal polite form)
${NO_TRANSLATE_INSTRUCTION}

Response:`;

export type GraphType = "search" | "cold_start" | "upsert_context" | "update_context" | "upsert_trail";

type PromptBuilder = (data: string, locale: string) => string;

export const GRAPH_PROMPT_BUILDERS: Record<GraphType, PromptBuilder> = {
  search: buildSearchPrompt,
  cold_start: buildColdStartPrompt,
  upsert_context: buildUpsertContextPrompt,
  update_context: buildUpdateContextPrompt,
  upsert_trail: buildUpsertTrailPrompt,
};

// Guard message types (flow-guard-checker)
export type GuardType =
  | "greeting"
  | "greetingWithProfileNoGoal"
  | "greetingWithProfileWithGoal"
  | "help"
  | "unknown"
  | "cancelNoActive"
  | "onboarding"
  | "goalNotSet"
  | "goalNotSetDelete"
  | "storyNotSet";

// Guard templates in English — returned as-is for English, translated by LLM for other languages
// IMPORTANT: No numbered lists — conversational style to avoid numeric responses
export const GUARD_TEMPLATES: Record<GuardType, string> = {
  greeting: `👋 Hi! I'm WayMates — I help find people who made career transitions like yours.

You can share your career story for better matching, or just describe your current position for a quick search. What would you like to do?`,

  greetingWithProfileNoGoal: `👋 Welcome back!

You can set a career goal to find people who achieved it, search for similar professionals, or update your profile. What interests you?`,

  greetingWithProfileWithGoal: `👋 Welcome back!

Ready to search for pathfinders or similar professionals? Or would you like to change your goal or update your profile?`,

  help: `I help you find career connections: similar professionals (waymates) and people who achieved your target position (pathfinders).

Just describe your current position or career goal to get started.`,

  unknown: `I didn't quite catch that. Try describing your current position (role, level, country) or your career goal.`,

  cancelNoActive: `Nothing to cancel — no active operation.`,

  onboarding: `👋 Hi! I'm WayMates — I help find people who made career transitions like yours.

You can share your career story for better matching, or just describe your current position for a quick search. What would you like to do?`,

  goalNotSet: `You don't have a goal set yet.

To set one, describe the position you want to achieve.`,

  goalNotSetDelete: `No goal to delete — you haven't set one yet.`,

  storyNotSet: `You don't have a profile yet.

Share your career history to create one.`,
};

export function buildGuardTranslationPrompt(template: string, locale: string): string {
  return `Translate to language code "${locale}". Keep structure and formatting exactly as in original.

CRITICAL: Do NOT translate brand terms — keep exactly as-is: ${BRAND_TERMS.join(", ")}

${template}`;
}
