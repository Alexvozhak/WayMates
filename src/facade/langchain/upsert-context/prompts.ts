import type { UserContext } from "../../../shared/schemas.js";
import type { BaseMessage } from "@langchain/core/messages";

function serializeMessages(messages: BaseMessage[]): string {
  /* eslint-disable-next-line @typescript-eslint/no-deprecated -- LangChain message type access */
  return messages.map((m) => `${m._getType()}: ${m.content}`).join("\n");
}

export const SYSTEM_PROMPT = `You are a career context extraction assistant.

═══════════════════════════════════════════════════
TOOL CHAINING RULES
═══════════════════════════════════════════════════

1. User sends NLP message describing a new career position
2. IMMEDIATELY call extract_context to extract structured data
3. extract_context → IMMEDIATELY call show_context (shows context, waits for user)
4. show_context returns userResponse → YOU analyze → call confirm_context OR edit_context OR cancel
5. confirm_context → saved

═══════════════════════════════════════════════════
4-PHASE WORKFLOW
═══════════════════════════════════════════════════

PHASE 1: EXTRACTING (phase="extracting")
- User describes new career context in natural language
- Call extract_context to parse into structured format
- Example: "Я работаю senior backend в Яндексе с 2023 года в Москве"

PHASE 2: AWAITING_CONFIRMATION (phase="awaiting_confirmation")
- Show extracted context to user
- User confirms, edits, or rejects

PHASE 3: SAVED (phase="saved")
- Return context to MCP handler
- Handler saves to database

PHASE 4: FAILED (phase="failed")
- Extraction failed or user cancelled

═══════════════════════════════════════════════════
INTENT PARSING (after show_context returns)
═══════════════════════════════════════════════════

A. APPROVE: "да", "yes", "ok", "подтверждаю", "save", "сохранить"
   → call confirm_context

B. REJECT: "нет", "no", "cancel", "отмена"
   → respond "Context creation cancelled" and STOP

C. EDIT: "измени", "edit", "поправь", "добавь X", "убери Y"
   → call edit_context with corrections

═══════════════════════════════════════════════════
FORMATTING RULES
═══════════════════════════════════════════════════

When showing extracted context:
"New career context:

• Position: [position]
• Company/Industry: [industry]
• Domains: [domains]
• Skills: [skills]
• City: [cityName]
• Period: [startDate] - [endDate or 'present']

Save this context?"
`;

export function contextExtractionPrompt(userMessage: string, messages: BaseMessage[]): string {
  const messagesText = serializeMessages(messages);

  return `Extract career context from user's natural language description.

USER MESSAGE:
${userMessage}

CONVERSATION HISTORY:
${messagesText}

═══════════════════════════════════════════════════
TASK: Extract career context into structured format
═══════════════════════════════════════════════════

Extract these fields from the message:
- position: job title (lowercase-kebab-case, e.g., "senior-backend-developer")
- industry: company industry (e.g., "fintech", "e-commerce")
- domains: work domains array (e.g., ["backend", "api-development"])
- skills: technical skills array (e.g., ["python", "postgresql", "kubernetes"])
- cityName: city name (e.g., "москва", "berlin")
- createdAt: ISO 8601 datetime when this position STARTED (e.g., "2023-03-01T00:00:00Z")
- creationReason: array with at least one reason (use "started_working" for first job, "promoted" for promotion, "changed_company" for new company)

FORMAT RULES:
- All terms: lowercase-kebab-case
- Skills and domains: lowercase, no special characters
- createdAt: ISO 8601 format with timezone (YYYY-MM-DDTHH:mm:ssZ)
- If date not mentioned: use current date
- If field not mentioned: use reasonable defaults or leave empty array

EXAMPLES:
Input: "Я работаю senior backend в Яндексе с марта 2023 в Москве, пишу на Python и Go"
Output:
- position: "senior-backend-developer"
- industry: "tech"
- domains: ["backend"]
- skills: ["python", "go"]
- cityName: "москва"
- createdAt: "2023-03-01T00:00:00Z"
- creationReason: ["started_working"]

Input: "Перешёл на junior frontend в банк в январе 2024, React, TypeScript, Питер"
Output:
- position: "junior-frontend-developer"
- industry: "fintech"
- domains: ["frontend"]
- skills: ["react", "typescript"]
- cityName: "санкт-петербург"
- createdAt: "2024-01-01T00:00:00Z"
- creationReason: ["changed_company"]`;
}

export function contextEditPrompt(existingContext: UserContext, corrections: string, messages: BaseMessage[]): string {
  const messagesText = serializeMessages(messages);

  return `Apply corrections to career context.

CURRENT CONTEXT:
${JSON.stringify(existingContext, null, 2)}

USER CORRECTIONS:
${corrections}

CONVERSATION HISTORY:
${messagesText}

═══════════════════════════════════════════════════
TASK: Return COMPLETE corrected context
═══════════════════════════════════════════════════

Apply corrections while preserving all other fields.
Return full context with corrections applied.

FORMAT RULES:
- All terms: lowercase-kebab-case
- Preserve contextId, previousContextId, nextContextId, createdAt`;
}
