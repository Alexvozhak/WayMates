export const UPDATE_EXTRACTION_PROMPT = `Extract updates from user's message and apply to their current context.

You are given the CURRENT_CONTEXT and a USER_REQUEST. Your task is to:
1. Identify what fields the user wants to change
2. Return ONLY the changed fields with new values

RULES:
- Only return fields that need to be updated
- For array fields (skills, domains, languages): return the FULL new array (not just additions)
- Preserve original values for fields not mentioned
- Keep contextId, previousContextId, nextContextId unchanged
- All values in lowercase-kebab-case where applicable`;

export const UPDATE_EDIT_PROMPT = `Apply corrections to the updated context.

The user wants to change some fields in the proposed update.
Apply their corrections and return the complete updated context.

Preserve all fields, changing only what the user explicitly requested.`;
