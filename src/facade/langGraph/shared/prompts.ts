import type { AdhocContextBase, TargetContext } from "../../../shared/schemas.js";

/**
 * Shared prompt fragments for context extraction.
 * Used by both adhoc (search-graph) and cold-start extraction.
 */

// Common field hints (DRY: used in both adhoc and goal descriptions)
const HINTS = {
  position: "map to KNOWN POSITIONS",
  role: "map to KNOWN ROLES",
  domains: "map to KNOWN DOMAINS",
  skills: "map to KNOWN SKILLS",
  industries: "map to KNOWN INDUSTRIES",
  cities: "map to KNOWN CITIES",
  education: "map to KNOWN EDUCATION LEVELS",
  countryCode: "ISO 3166-1 alpha-2",
  citizenships: "ISO 3166-1 alpha-2",
  languages: "ISO 639-1",
} as const;

/**
 * Field descriptions for adhoc context extraction.
 * Single source of truth for extraction prompts and NLP formatter.
 */
export const ADHOC_FIELD_DESCRIPTIONS: Record<keyof AdhocContextBase, string> = {
  position: `job title or seniority — ${HINTS.position}`,
  role: `profession function — ${HINTS.role}`,
  domains: `technical area — ${HINTS.domains}`,
  skills: `specific technologies or tools — ${HINTS.skills}`,
  industry: `business sector — ${HINTS.industries}`,
  companySize: "company size category (startup, SMB, enterprise)",
  cityName: `city where you work — ${HINTS.cities}`,
  countryCode: `work location country — ${HINTS.countryCode}`,
  citizenships: `passport countries — ${HINTS.citizenships}`,
  birthYear: "year of birth (for demographics)",
  educationLevel: `highest degree achieved — ${HINTS.education}`,
  languages: `spoken languages — ${HINTS.languages}`,
  salaryMin: "minimum current annual salary in USD (number, e.g. 100000)",
  salaryMax: "maximum current annual salary in USD (number, e.g. 150000)",
};

/**
 * Field descriptions for goal extraction.
 * Single source of truth for extraction prompts and NLP formatter.
 */
export const GOAL_FIELD_DESCRIPTIONS: Record<keyof TargetContext, string> = {
  position: `seniority level — ${HINTS.position}`,
  role: `profession type — ${HINTS.role}`,
  countries: `target work location — ${HINTS.countryCode}`,
  domains: `technical specialization — ${HINTS.domains}`,
  skills: `technologies or competencies — ${HINTS.skills}`,
  languages: `spoken languages — ${HINTS.languages}`,
  industries: `target business sector — ${HINTS.industries}`,
  cities: `target city — ${HINTS.cities}`,
  citizenships: `required passports — ${HINTS.citizenships}`,
  educationLevels: `required degree — ${HINTS.education}`,
  salaryMin: "minimum desired annual salary in USD (number, e.g. 150000)",
  salaryMax: "maximum desired annual salary in USD (number, e.g. 250000)",
};

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
