/**
 * Builds update extraction prompt with injected dictionary hints.
 * @param hints - Pre-built hints string from DictionariesService.buildHints()
 */
export function buildUpdateExtractionPrompt(hints: string): string {
  return `Extract updates from user's message to apply to their current context.
${hints}

IMPORTANT - distinguish these fields:
- role: profession type (WHAT you do) — map to KNOWN ROLES
- position: seniority level (HOW experienced) — map to KNOWN POSITIONS
- domains: technical specialization area — map to KNOWN DOMAINS
- skills: specific technologies/tools — map to KNOWN SKILLS
- industry: business sector — map to KNOWN INDUSTRIES

RULES:
- Only return fields that need to be updated (null for unchanged)
- For array fields (skills, domains, languages): return the FULL new array
- Map user input to KNOWN dictionary values (case-insensitive matching)
- Languages use ISO 639-1 UPPERCASE codes, countryCode uses ISO 3166-1 UPPERCASE codes
- Return null for fields not mentioned in user's message`;
}

/**
 * Builds update clarification prompt for editing proposed changes.
 * @param hints - Dictionary hints for validation
 * @param currentUpdate - JSON of the proposed update to modify
 * @param userCorrections - User's correction request
 */
export function buildUpdateClarificationPrompt(hints: string, currentUpdate: string, userCorrections: string): string {
  return `Apply user's corrections to the proposed context update.
${hints}

CURRENT PROPOSED UPDATE:
${currentUpdate}

USER CORRECTIONS:
${userCorrections}

MERGE RULES:
- Apply the user's requested changes to the proposed update
- Keep all other fields from the proposed update unchanged
- Map corrected values to KNOWN dictionary values
- Return the complete updated context with corrections applied`;
}
