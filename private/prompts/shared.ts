import type { AdhocContextBase, TargetContext } from "../../src/shared/schemas.js";

/**
 * Shared prompt fragments for context extraction.
 * Used by both adhoc (search-graph) and cold-start extraction.
 */

// Common field hints (DRY: used in both adhoc and goal descriptions)
const HINTS = {
  position: "map to {{KNOWN POSITIONS}}",
  role: "map to {{KNOWN ROLES}}",
  domains: "map to {{KNOWN DOMAINS}}",
  skills: "map to {{KNOWN SKILLS}}",
  industries: "map to {{KNOWN INDUSTRIES}}",
  cities: "map to {{KNOWN CITIES}}",
  education: "map to {{KNOWN EDUCATION LEVELS}}",
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
  citizenships: `nationality countries — ${HINTS.citizenships}`,
  birthYear: "year of birth (for demographics)",
  educationLevel: `highest degree achieved — ${HINTS.education}`,
  languages: `spoken languages — ${HINTS.languages}`,
  salaryMin: "minimum current annual salary in USD (number, e.g. 100000)",
  salaryMax: "maximum current annual salary in USD (number, e.g. 150000)",
};

/**
 * Human-readable field labels for NLP output.
 * Used in awaiting_clarification phase to show user-friendly field names.
 * Includes both context fields (AdhocContextBase) and trail fields.
 */
export const FIELD_DISPLAY_NAMES: Record<keyof AdhocContextBase | "skill" | "platform", string> = {
  position: "Position level",
  role: "Professional role",
  domains: "Work domains",
  skills: "Skills",
  industry: "Industry",
  companySize: "Company size",
  cityName: "City",
  countryCode: "Country",
  citizenships: "Citizenship",
  birthYear: "Year of birth",
  educationLevel: "Education level",
  languages: "Languages",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
  // Trail fields
  skill: "Learning skill",
  platform: "Learning platform",
};

/**
 * Human-readable labels for Goal (TargetContext) fields.
 * Used in showing_goal phase to display user-friendly field names.
 */
export const GOAL_FIELD_DISPLAY_NAMES: Record<keyof TargetContext, string> = {
  position: "Position level",
  role: "Professional role",
  domains: "Work domains",
  skills: "Skills",
  countries: "Countries",
  cities: "Cities",
  citizenships: "Citizenship",
  industries: "Industries",
  educationLevels: "Education level",
  languages: "Languages",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
};

/**
 * Field descriptions for goal extraction.
 * Single source of truth for extraction prompts and NLP formatter.
 */
/**
 * Fields to show in NLP output (excludes verbose fields: role, companySize, educationLevel).
 */
export const NLP_CANDIDATE_FIELDS = (
  [
    "position",
    "domains",
    "skills",
    "industry",
    "cityName",
    "countryCode",
    "citizenships",
    "birthYear",
    "languages",
    "salaryExact",
    "salaryMin",
    "salaryMax",
  ] as const
).join(", ");

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
JOB TITLE DECOMPOSITION:
═══════════════════════════════════════════════════
POSITION = career level from {{KNOWN POSITIONS}}
- If user's title EXISTS in {{KNOWN POSITIONS}} → use it exactly
- If title NOT in list and no level mentioned → null

ROLE = profession function from {{KNOWN ROLES}}
- What the person DOES day-to-day
- Title contains "manager" → role: manager
- Title contains "developer/engineer" → role: developer
- REQUIRED field — always map to {{KNOWN ROLES}}

DOMAINS = technical areas from {{KNOWN DOMAINS}} (ARRAY — can have multiple values)
- Include ALL domains user explicitly mentioned
- Do NOT infer from position or role

INDUSTRY = business sector from {{KNOWN INDUSTRIES}}
- Use EXACT match if user mentioned it
- Do NOT generalize (e.g. specific → generic)
`;
