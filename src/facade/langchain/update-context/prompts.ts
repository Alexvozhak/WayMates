import type { UserContext } from "../../../shared/schemas.js";
import type { BaseMessage } from "@langchain/core/messages";

function serializeMessages(messages: BaseMessage[]): string {
  return messages.map((m) => `${m.type}: ${m.content}`).join("\n");
}

export const SYSTEM_PROMPT = `You are a career context update assistant.

═══════════════════════════════════════════════════
TOOL CHAINING RULES
═══════════════════════════════════════════════════

1. User message arrives with currentContext already loaded in state
2. IMMEDIATELY call extract_updates to apply changes
3. extract_updates → IMMEDIATELY call show_updated_context (shows diff, waits for user)
4. show_updated_context returns userResponse → YOU analyze → call confirm_update OR edit_context OR cancel
5. confirm_update → saved

═══════════════════════════════════════════════════
4-PHASE WORKFLOW
═══════════════════════════════════════════════════

PHASE 1: COLLECTING (phase="collecting")
- currentContext is already provided in state
- User describes updates in natural language
- Call extract_updates to apply changes to context
- LLM extracts: position changes, new skills, domain updates, etc.

PHASE 2: CLARIFICATION (phase="awaiting_clarification")
- If validation fails → ask_clarification
- User provides missing data
- Retry extract_updates

PHASE 3: CONFIRMATION (phase="awaiting_confirmation")
- Show diff: before → after
- User confirms, edits, or rejects

PHASE 4: SAVED (phase="saved")
- Return updated context to MCP handler
- Handler saves to database

═══════════════════════════════════════════════════
INTENT PARSING (after show_updated_context returns)
═══════════════════════════════════════════════════

A. APPROVE: "да", "yes", "ok", "подтверждаю", "save", "сохранить"
   → call confirm_update

B. REJECT: "нет", "no", "cancel", "отмена"
   → respond "Update cancelled" and STOP

C. EDIT: "измени", "edit", "поправь", "добавь X", "убери Y"
   → call edit_context with corrections

═══════════════════════════════════════════════════
FORMATTING RULES
═══════════════════════════════════════════════════

When showing update preview:
"Changes to your career context:

BEFORE:
• Position: [old value]
• Skills: [old skills]

AFTER:
• Position: [new value]
• Skills: [new skills]

Save these changes?"
`;

export function updateExtractionPrompt(
  currentContext: UserContext,
  userMessage: string,
  messages: BaseMessage[],
): string {
  const messagesText = serializeMessages(messages);

  return `Apply updates to career context based on user's request.

CURRENT CONTEXT:
${JSON.stringify(currentContext, null, 2)}

USER REQUEST:
${userMessage}

CONVERSATION HISTORY:
${messagesText}

═══════════════════════════════════════════════════
TASK: Extract changes from user's message and apply to context
═══════════════════════════════════════════════════

Examples:
- "Добавь React в навыки" → add "react" to skills array
- "Измени позицию на senior" → change position to "senior"
- "Теперь работаю в fintech" → change industry to "fintech"
- "Добавь Python и Go" → add ["python", "go"] to skills

FORMAT RULES:
- All terms: lowercase-kebab-case
- Return COMPLETE updated context with ALL fields
- Only change fields mentioned by user
- Preserve all other fields unchanged

EXTRACT ONLY what user explicitly requests - do NOT infer additional changes.`;
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
Return full context with corrections applied.`;
}
