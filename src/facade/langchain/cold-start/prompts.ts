import type { Trail, UserContext } from "../../../shared/schemas.js";
import type { BaseMessage } from "@langchain/core/messages";

function serializeMessages(messages: BaseMessage[]): string {
  return messages.map((m) => `${m.type}: ${m.content}`).join("\n");
}

export const SYSTEM_PROMPT = `You are a career history collection assistant for cold start onboarding.

═══════════════════════════════════════════════════
5-PHASE WORKFLOW
═══════════════════════════════════════════════════

PHASE 1: STORY GATHERING (phase="story_gathering")
- Listen to user's career story
- Ask follow-up questions if needed
- When user says "готово"/"done"/"that's all" → call plan_career_history

PHASE 2: PLANNING (phase="planning" → "awaiting_plan_confirmation")
- plan_career_history analyzes messages and builds queue
- Shows timeline for user confirmation
- User confirms → advance to collection

PHASE 3: SEQUENTIAL COLLECTION (phase="sequential_collection")
- For each context in queue:
  - Call process_entity_batch with contextIndex
  - If validation fails → ask_clarification (automatic)
  - If success → confirm_context (automatic)
  - User confirms → advance to next context
- When all contexts done → final preview

PHASE 4: FINAL PREVIEW (phase="awaiting_final_confirmation")
- Show ALL collected data for final confirmation
- User confirms → saved

PHASE 5: SAVED (phase="saved")
- Return collected data to MCP handler
- Handler saves to database

═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
1. Respond: "Workflow cancelled. Your data was not saved."
2. DO NOT call any tools
3. Stop workflow

═══════════════════════════════════════════════════
AFTER PLAN CONFIRMATION (phase="awaiting_plan_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "correct", "looks good"
   → Call process_entity_batch({ contextIndex: 0 })

2. CORRECTION: "add X", "remove Y", "change order"
   → Call plan_career_history again (re-plan with corrections in messages)

3. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
AFTER CLARIFICATION (phase="awaiting_clarification")
═══════════════════════════════════════════════════

User provides answers to questions.
→ Call process_entity_batch with same contextIndex (re-extract with answers)

═══════════════════════════════════════════════════
AFTER CONTEXT CONFIRMATION (phase="awaiting_context_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "ok"
   → Check progress.current vs progress.total from last response:
     - If current < total: Call process_entity_batch({ contextIndex: current })
     - If current == total (all done): Call confirm_final() to show final preview

2. MINOR CORRECTION: "add skill X", "change position to Y"
   → Call edit_context({ contextId, corrections }) or edit_trail({ trailId, corrections })

3. MAJOR CORRECTION: "that's wrong position", "re-extract"
   → Call process_entity_batch with same contextIndex

4. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
AFTER FINAL CONFIRMATION (phase="awaiting_final_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "save", "сохранить"
   → Return phase="saved" (MCP handler will save)

2. CORRECTION: "change X"
   → Navigate back to specific context or use edit_context/edit_trail

3. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
FORMATTING RULES
═══════════════════════════════════════════════════

When showing plan (awaiting_plan_confirmation):
"Your career timeline:
1. [preview] (no transitions before)
2. [preview] ← [trail previews]
3. [preview] ← [trail previews]

Is this correct?"

When showing context (awaiting_context_confirmation):
"Context #[current] of [total]:
• Position: [position]
• Company: [company]
• Period: [dates]
• Skills: [skills]

Related transitions:
• [trail info]

Is this correct?"

When showing final preview (awaiting_final_confirmation):
"Final preview of your career history:

[count] positions:
1. [position] at [company] ([dates])
   Skills: [skills]
   ← [transition info]

Save this?"

═══════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════

1. ALWAYS follow tool goto routing (deterministic business logic)
2. Interpret user intent through natural language
3. When in doubt:
   - Clarification context → treat as answers
   - Confirmation context → ask for clarification
4. DO NOT parse/validate data yourself - tools handle that
5. Use progress.current from response to track sequential collection
`;

export function planningPrompt(messages: BaseMessage[]): string {
  const messagesText = serializeMessages(messages);

  return `Analyze career history and create a collection plan.

CONVERSATION:
${messagesText}

═══════════════════════════════════════════════════
YOUR TASK: Identify all career positions in CHRONOLOGICAL order (oldest → newest)
═══════════════════════════════════════════════════

For each position, return:
1. preview: Short label - "Role at Company YYYY-YYYY" (e.g., "Junior Developer at Yandex 2018-2020")
2. incomingTrails: Learning activities that LED TO this position (from the previous one)

═══════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════
- First position has EMPTY incomingTrails array (no prior context to transition from)
- Trails describe HOW the person transitioned: courses, certifications, bootcamps, self-study
- Trail preview format: "Platform Course Name YYYY" (e.g., "Coursera Machine Learning 2019")
- Include promotions and internal moves as separate positions if significantly different
- Education → first job counts as first position (no incoming trail needed)

═══════════════════════════════════════════════════
EXAMPLE OUTPUT:
═══════════════════════════════════════════════════
contexts: [
  { preview: "Intern at Startup 2017-2018", incomingTrails: [] },
  { preview: "Junior Python Dev at Yandex 2018-2020", incomingTrails: ["CS50 Harvard course 2017"] },
  { preview: "Senior Backend at Google 2020-2023", incomingTrails: ["System Design course 2020", "Go Lang bootcamp 2020"] }
]`;
}

export function contextExtractionPrompt(messages: BaseMessage[], preview: string): string {
  const text = serializeMessages(messages);
  return `Extract career context for: "${preview}"

CONVERSATION:
${text}

═══════════════════════════════════════════════════
FORMAT RULES (STRICT):
═══════════════════════════════════════════════════
- All terms: lowercase-kebab-case (e.g., "machine-learning", "data-science")
- cityName: lowercase (e.g., "berlin", "san-francisco")
- countryCode/citizenships: lowercase ISO 3166-1 alpha-2 (e.g., "de", "ru")
- languages: lowercase ISO 639-1 (e.g., "en", "de")
- DO NOT invent data - extract ONLY what is explicitly mentioned

═══════════════════════════════════════════════════
REQUIRED FIELDS (must extract):
═══════════════════════════════════════════════════
- position: Job level (e.g., "junior", "middle", "senior", "lead")
- domains: Work areas (e.g., ["frontend", "backend", "devops"]) - min 1
- skills: Technical skills explicitly mentioned (e.g., ["react", "typescript"]) - min 1
- industry: Company's industry (e.g., "tech", "fintech", "e-commerce")
- companySize: Approximate size (e.g., "startup", "50-200", "1000+")
- countryCode: ISO 3166-1 alpha-2 lowercase (e.g., "us", "de", "ru")
- cityName: City name lowercase (e.g., "berlin", "moscow")
- citizenships: Citizenship codes lowercase (e.g., ["ru", "de"])
- birthYear: Year of birth (e.g., 1990)
- creationReason: Why this job started. Choose from:
  started_working, got_promoted, changed_position, changed_company,
  changed_industry, changed_domain, got_fired, burnout, relocation,
  education_upgrade, career_restart, management_transition, tech_shift

═══════════════════════════════════════════════════
OPTIONAL FIELDS (include ONLY if explicitly mentioned):
═══════════════════════════════════════════════════
- educationLevel: NONE, HIGH_SCHOOL, ASSOCIATE, BACHELOR, MASTER, DOCTORATE, PROFESSIONAL
- salaryExact: Exact annual salary in USD (OR use salaryMin/salaryMax for range)
- salaryMin/salaryMax: Salary range bounds in USD
- languages: ISO 639-1 lowercase for B2+ proficiency (e.g., ["en", "de"])
- feedback: Personal reflection on this transition (max 200 chars)

EXTRACTION RULES:
- Extract ONLY explicitly mentioned information - do NOT infer or guess
- For first job, use creationReason: ["started_working"]
- If skill/domain not explicitly stated, do NOT add it`;
}

export function trailExtractionPrompt(messages: BaseMessage[], trailPreview: string): string {
  const text = serializeMessages(messages);
  return `Extract learning trail for: "${trailPreview}"

CONVERSATION:
${text}

═══════════════════════════════════════════════════
FORMAT RULES (STRICT):
═══════════════════════════════════════════════════
- All terms: lowercase-kebab-case (e.g., "machine-learning", "system-design")
- DO NOT invent data - extract ONLY what is explicitly mentioned

═══════════════════════════════════════════════════
REQUIRED FIELDS (must extract):
═══════════════════════════════════════════════════
- skill: The main skill being developed (e.g., "react", "python", "machine-learning")
- platform: Where learning happened (e.g., "coursera", "udemy", "self-study", "bootcamp")

═══════════════════════════════════════════════════
OPTIONAL FIELDS (include ONLY if explicitly mentioned):
═══════════════════════════════════════════════════
- totalDurationWeeks: Learning duration in weeks
- schedule: { sessionsPerWeek: number, hoursPerSession: number }
- costUsd: Total cost in USD
- courseName: Specific course title (lowercase-kebab-case)
- courseLink: URL to the course
- ratingCourse: User's rating of the course (1-5)
- ratingPlatform: User's rating of the platform (1-5)
- ratingSchedule: User's rating of the schedule/format (1-5)
- userFeedback: Personal notes about the learning experience

EXTRACTION RULES:
- Extract ONLY explicitly mentioned information - do NOT infer or guess
- Trail describes learning/transition activities between career positions
- Focus on the specific learning activity mentioned in the preview`;
}

export function contextCorrectionPrompt(
  existingContext: UserContext,
  corrections: string,
  messages: BaseMessage[],
): string {
  const messagesText = serializeMessages(messages);

  return `Apply corrections to the following career context.

ORIGINAL CONTEXT:
${JSON.stringify(existingContext, null, 2)}

USER CORRECTIONS:
${corrections}

CONVERSATION HISTORY (for additional context):
${messagesText}

═══════════════════════════════════════════════════
TASK: Return the COMPLETE corrected context object
═══════════════════════════════════════════════════

Apply the user's corrections while preserving all other fields.
Return the full context with corrections applied.
DO NOT return partial data - include ALL fields from the original.`;
}

export function trailCorrectionPrompt(
  existingTrail: Trail,
  corrections: string,
  messages: BaseMessage[],
): string {
  const messagesText = serializeMessages(messages);

  return `Apply corrections to the following learning trail.

ORIGINAL TRAIL:
${JSON.stringify(existingTrail, null, 2)}

USER CORRECTIONS:
${corrections}

CONVERSATION HISTORY (for additional context):
${messagesText}

═══════════════════════════════════════════════════
TASK: Return the COMPLETE corrected trail object
═══════════════════════════════════════════════════

Apply the user's corrections while preserving all other fields.
Return the full trail with corrections applied.
DO NOT return partial data - include ALL fields from the original.`;
}
