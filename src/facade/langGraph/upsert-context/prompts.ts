/**
 * Builds context extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildContextExtractionPrompt(hints: string): string {
  return `Extract career context from user's natural language description.
${hints}
IMPORTANT - distinguish these 3 fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical specialization area (answers 'what kind of developer/engineer?') — map to KNOWN DOMAINS

Return null for fields not mentioned.`;
}

export const CONTEXT_EDIT_PROMPT = `Apply corrections to career context.

Apply user's requested changes to the current context data.
Preserve all unchanged fields, including contextId.

Return the complete updated context JSON.`;
