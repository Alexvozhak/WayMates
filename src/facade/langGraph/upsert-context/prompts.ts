/**
 * Builds context extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildContextExtractionPrompt(hints: string): string {
  return `Extract career context from user's natural language description.
${hints}

IMPORTANT - distinguish these fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical specialization area (answers 'what kind of developer/engineer?') — map to KNOWN DOMAINS
- skills: specific technologies/tools — map to KNOWN SKILLS
- industry: business sector — map to KNOWN INDUSTRIES

RULES:
- Map user input to KNOWN dictionary values (case-insensitive matching)
- Languages use ISO 639-1 UPPERCASE codes, countryCode uses ISO 3166-1 UPPERCASE codes
- Return null for fields not mentioned in user's message`;
}

/**
 * Builds context clarification prompt for editing extracted context.
 * @param hints - Dictionary hints for validation
 * @param currentContext - JSON of the extracted context to modify
 * @param userCorrections - User's correction request
 */
export function buildContextClarificationPrompt(
  hints: string,
  currentContext: string,
  userCorrections: string,
): string {
  return `Apply user's corrections to the extracted career context.
${hints}

CURRENT EXTRACTED CONTEXT:
${currentContext}

USER CORRECTIONS:
${userCorrections}

MERGE RULES:
- Apply the user's requested changes to the current context
- Keep all other fields unchanged
- Map corrected values to KNOWN dictionary values
- Return the complete context with corrections applied`;
}
