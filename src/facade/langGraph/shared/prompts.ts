/**
 * Shared prompt fragments for context extraction.
 * Used by both adhoc (search-graph) and cold-start extraction.
 */

/**
 * Job title decomposition rules.
 * Teaches LLM to split compound titles into position + role + domains.
 */
export const DECOMPOSITION_RULES = `
═══════════════════════════════════════════════════
DECOMPOSITION APPROACH:
═══════════════════════════════════════════════════
Job titles encode multiple independent dimensions. Extract ALL THREE from a single title:

1. POSITION = the full title as recognized in KNOWN POSITIONS
2. ROLE = the job FUNCTION word within the title — map to KNOWN ROLES
3. DOMAINS = areas of work or expertise — map to KNOWN DOMAINS

ROLE EXTRACTION:
- The LAST word in job title usually indicates the job function
- This function word maps directly to KNOWN ROLES
- Titles ending with management or leadership words → role is manager
- Titles ending with engineering or development words → role is developer
- ROLE is REQUIRED — extract it from the title structure

DOMAINS EXTRACTION:
- Include BOTH technical area AND functional area if present
- If the person manages or leads teams → include management in domains
- If the person works in a technical area → include that technical domain

INDUSTRY PRECISION:
- Use the EXACT industry user mentioned if it exists in KNOWN INDUSTRIES
- Specialized sub-sectors take precedence over broad categories
`;
