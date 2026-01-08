import { CONTEXT_REQUIRED_FIELDS } from "../../../shared/schemas.js";
import { DECOMPOSITION_RULES } from "../shared/prompts.js";

import { PHASE } from "./types.js";

import type { UserContext } from "../../../shared/schemas.js";
import type { RolePositionSuggestion } from "../../services/normalizer.js";
import type { BaseMessage } from "@langchain/core/messages";

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_DIVIDER = "═══════════════════════════════════════════════════";

/** Current date for relative date calculations */
export function getCurrentDateContext(): string {
  return `Current date: ${new Date().toISOString().split("T")[0]}`;
}

/** Rule: each position is extracted independently */
const POSITION_INDEPENDENCE_RULE = `
POSITION INDEPENDENCE (CRITICAL):
Each position is extracted INDEPENDENTLY. For fields [${CONTEXT_REQUIRED_FIELDS.join(", ")}]:
- Extract ONLY values explicitly stated for THIS specific position
- Do NOT inherit or copy from other positions
- Missing fields will be clarified separately`;

/** Common format rules for all extractions */
const FORMAT_RULES_BASE = `
- All terms: lowercase-kebab-case
- countryCode, citizenships: ISO 3166-1 alpha-2 UPPERCASE
- languages: ISO 639-1
- cityName: null unless explicitly mentioned
- Do NOT invent data — extract ONLY explicit statements
- If not mentioned → JSON null. NEVER return string "null" or empty values (0, "", [])`;

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT (Agent orchestration)
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEM_PROMPT = `You are a career history collection assistant.

${SECTION_DIVIDER}
INTERRUPT RULES (CRITICAL)
${SECTION_DIVIDER}

show_* tools use interrupt() to PAUSE for user input.
After user responds, analyze userResponse and decide next action.

NEVER batch show_* with confirm_* in same invoke — wait for interrupt first.

${SECTION_DIVIDER}
PHASE-SPECIFIC BEHAVIOR
${SECTION_DIVIDER}

${PHASE.story_gathering}:
  Listen to user's career story. When user signals completion → plan.

${PHASE.awaiting_plan_confirmation}:
  User reviews career timeline.
  APPROVE → confirm plan
  EDIT → re-plan with corrections
  CANCEL → stop workflow

${PHASE.awaiting_clarification}:
  User provides missing information OR chooses from suggestions.
  ANSWER → re-extract with provided data
  APPROVE (when suggestions shown) → accept suggested values
  CANCEL → stop workflow

${PHASE.awaiting_context_confirmation}:
  User reviews extracted position data.
  APPROVE → confirm and proceed to next
  EDIT → apply corrections
  CANCEL → stop workflow

${PHASE.awaiting_final_confirmation}:
  User reviews complete career history.
  APPROVE → save
  EDIT → go back to specific context
  CANCEL → stop workflow

${SECTION_DIVIDER}
RULES
${SECTION_DIVIDER}

1. Follow ToolMessage instructions for next action
2. Interpret user intent semantically, not literally
3. Do NOT parse/validate data — tools handle that
4. Use progress.current to track sequential collection
`;

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function serializeMessages(messages: BaseMessage[]): string {
  return messages.map((m) => `${m.type}: ${m.content}`).join("\n");
}

function serializeSuggestions(suggestions: RolePositionSuggestion[]): string {
  return suggestions
    .map((s) => `${s.field}: original="${s.original}" → options: [${s.suggestions.join(", ")}]`)
    .join("\n");
}

export function planningPrompt(messages: BaseMessage[], cvText: string | null): string {
  const messagesText = serializeMessages(messages);
  const cvSection = cvText
    ? `
${SECTION_DIVIDER}
CV/RESUME:
${SECTION_DIVIDER}
${cvText}

Note: Use BOTH conversation and CV. If conflict → prioritize conversation.
`
    : "";

  return `Analyze career history and create a collection plan.

${getCurrentDateContext()}

CONVERSATION:
${messagesText}
${cvSection}
${SECTION_DIVIDER}
TASK: Identify all career positions in CHRONOLOGICAL order (oldest → newest)
${SECTION_DIVIDER}

// FROZEN: incomingTrails disabled

${DECOMPOSITION_RULES}

${SECTION_DIVIDER}
RULES:
${SECTION_DIVIDER}
// FROZEN: Trails collection disabled
- Include promotions as separate positions if significantly different
- Education is NOT a position — only paid work experience counts
- Relative dates: "N years ago" means START = current year - N
- If no end date → position continues to present`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function buildContextExtractionRules(hasCv: boolean): string {
  const cvNote = hasCv ? "Use BOTH sources. If conflict → prioritize conversation.\n\n" : "";
  return `${cvNote}FORMAT RULES:
${FORMAT_RULES_BASE}`;
}

export function contextExtractionPrompt(
  messages: BaseMessage[],
  preview: string,
  cvText: string | null,
  dictHints = "",
): string {
  const text = serializeMessages(messages);
  const cvSection = cvText
    ? `
${SECTION_DIVIDER}
CV/RESUME:
${SECTION_DIVIDER}
${cvText}
`
    : "";

  return `Extract career context for THIS SINGLE POSITION ONLY: "${preview}"

${SECTION_DIVIDER}
SINGLE POSITION EXTRACTION (CRITICAL):
${SECTION_DIVIDER}
- Extract data EXCLUSIVELY for the position specified above
- The conversation may mention multiple positions — focus ONLY on "${preview}"
- If information is not explicitly associated with this position, use null
- Do NOT merge data from different positions into one

${getCurrentDateContext()}
${dictHints}
CONVERSATION:
${text}
${cvSection}
${SECTION_DIVIDER}
${buildContextExtractionRules(!!cvText)}
${SECTION_DIVIDER}

${DECOMPOSITION_RULES}

${SECTION_DIVIDER}
CAREER MODEL:
${SECTION_DIVIDER}
- ROLE: Profession type (WHAT you do) — map to KNOWN ROLES
- POSITION: Seniority level (HOW experienced) — map to KNOWN POSITIONS
- DOMAINS: Technical specialization — map to KNOWN DOMAINS
- INDUSTRY: Company's business sector — map to KNOWN INDUSTRIES
- CREATION REASON: Why this context was created — map to KNOWN REASONS

${SECTION_DIVIDER}
OPTIONAL FIELDS (include ONLY if explicitly mentioned):
${SECTION_DIVIDER}
- educationLevel: highest degree — map to KNOWN EDUCATION LEVELS
- salaryExact: exact annual salary in USD
- salaryMin/salaryMax: salary range in USD (use EITHER exact OR range)
- feedback: user's reflection about THIS position (max 200 chars)

${SECTION_DIVIDER}
SKILLS EXTRACTION:
${SECTION_DIVIDER}
1. EXPLICIT: Skills directly mentioned in position description
2. INFERRED: Match CV skills to position by title, industry, chronology

${POSITION_INDEPENDENCE_RULE}

${SECTION_DIVIDER}
createdAt FIELD (CRITICAL):
${SECTION_DIVIDER}
Extract START DATE from preview period.
Format: ISO 8601 (YYYY-MM-DDT00:00:00Z)
Use January 1st if only year given.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FROZEN: TRAIL EXTRACTION PROMPT disabled
// ═══════════════════════════════════════════════════════════════════════════
//
// export function trailExtractionPrompt(messages: BaseMessage[], trailPreview: string): string {
//   const text = serializeMessages(messages);
//   return `Extract learning trail for: "${trailPreview}"
//
// CONVERSATION:
// ${text}
//
// ${SECTION_DIVIDER}
// FORMAT RULES:
// ${SECTION_DIVIDER}
// - All terms: lowercase-kebab-case
// - Do NOT invent data — extract ONLY what is mentioned
//
// ${SECTION_DIVIDER}
// REQUIRED FIELDS:
// ${SECTION_DIVIDER}
// - skill: Main skill being developed
// - platform: Where learning happened
//
// ${SECTION_DIVIDER}
// OPTIONAL FIELDS (include ONLY if mentioned):
// ${SECTION_DIVIDER}
// - totalDurationWeeks, schedule, costUsd
// - courseName, courseLink
// - ratingCourse, ratingPlatform, ratingSchedule (1-5)
// - userFeedback`;
// }

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT CORRECTION PROMPT
// ═══════════════════════════════════════════════════════════════════════════

export function contextCorrectionPrompt(existingContext: UserContext, corrections: string): string {
  return `Apply user corrections to career context.

${SECTION_DIVIDER}
ORIGINAL CONTEXT:
${SECTION_DIVIDER}
${JSON.stringify(existingContext, null, 2)}

${SECTION_DIVIDER}
USER CORRECTION:
${SECTION_DIVIDER}
"${corrections}"

${SECTION_DIVIDER}
TASK:
${SECTION_DIVIDER}
Apply correction EXACTLY as requested.
- Change field value: set to new value
- Add to array: append items
- Remove from array: remove items
- CRITICAL: For fields NOT mentioned in correction, COPY the original value exactly as-is. NEVER return null for unchanged fields.
- Return COMPLETE context with ALL fields populated (either changed or copied from original)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT CLARIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════

export function contextClarificationPrompt(
  pendingContext: Record<string, unknown>,
  missingFields: string[],
  suggestions: RolePositionSuggestion[],
  userResponse: string,
  dictHints: string,
): string {
  const hasMissing = missingFields.length > 0;
  const hasSuggestions = suggestions.length > 0;

  const missingSection = hasMissing
    ? `
${SECTION_DIVIDER}
MISSING FIELDS (user was asked to provide):
${SECTION_DIVIDER}
${missingFields.join(", ")}`
    : "";

  const suggestionsSection = hasSuggestions
    ? `
${SECTION_DIVIDER}
FIELD SUGGESTIONS (user was asked to CHOOSE):
${SECTION_DIVIDER}
${serializeSuggestions(suggestions)}`
    : "";

  const mergeRules = hasSuggestions
    ? `
${SECTION_DIVIDER}
MERGE RULES (SUGGESTIONS MODE):
${SECTION_DIVIDER}
- User was asked to CHOOSE from options
- If user APPROVES without specifying → use FIRST option for each field
- If user provides specific value → use it (map to KNOWN values)
- KEEP all existing values unchanged`
    : `
${SECTION_DIVIDER}
MERGE RULES (MISSING FIELDS MODE):
${SECTION_DIVIDER}
- User response answers questions about MISSING FIELDS
- Extract values from response (map to KNOWN values from hints)
- KEEP all existing values unchanged`;

  return `Update career context based on user's clarification.
${dictHints}
${SECTION_DIVIDER}
CURRENT CONTEXT:
${SECTION_DIVIDER}
${JSON.stringify(pendingContext, null, 2)}
${missingSection}${suggestionsSection}

${SECTION_DIVIDER}
USER RESPONSE:
${SECTION_DIVIDER}
"${userResponse}"
${mergeRules}
- Do NOT duplicate values in arrays
- All terms: lowercase-kebab-case
- countryCode, citizenships: ISO 3166-1 alpha-2 UPPERCASE`;
}
