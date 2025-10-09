import { type ContextField, FlexiblePreset } from "../schemas-zod.js";

type FieldSnippet = {
  startPattern: string;
  strict: string;
  flexible: (weight: number) => string;
};
type FieldSnippets = Record<ContextField, FieldSnippet>;

export const FIELD_SNIPPETS = {
  position: {
    startPattern: `MATCH (c:Context {position: $value})`,
    strict: `dbCurrentContext.position = requestedCurrentContext.position`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.position = requestedCurrentContext.position THEN ${weight} ELSE 0 END`,
  },

  domains: {
    startPattern: `MATCH (c:Context) WHERE ANY(d IN $domains WHERE d IN c.domains)`,
    strict: `all(d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains)`,
    flexible: (weight: number) =>
      `CASE WHEN size([d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains]) > 0 
      THEN ${weight} * (toFloat(size([d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains])) / size(requestedCurrentContext.domains)) 
      ELSE 0 END`,
  },

  skills: {
    startPattern: `MATCH (c:Context) WHERE ANY(s IN [skill IN $skills | skill.name] WHERE s IN c.skills)`,
    strict: `all(s IN requestedCurrentContext.skills WHERE s IN dbCurrentContext.skills)`,
    flexible: (weight: number) =>
      `CASE WHEN size([s IN requestedCurrentContext.skills WHERE s IN dbCurrentContext.skills]) > 0 
      THEN ${weight} * (toFloat(size([s IN requestedCurrentContext.skills WHERE s IN dbCurrentContext.skills])) / size(requestedCurrentContext.skills)) 
      ELSE 0 END`,
  },

  industry: {
    startPattern: `MATCH (c:Context {industry: $value})`,
    strict: `dbCurrentContext.industry = requestedCurrentContext.industry`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.industry = requestedCurrentContext.industry THEN ${weight} ELSE 0 END`,
  },

  country_code: {
    startPattern: `MATCH (c:Context {country_code: $value})`,
    strict: `dbCurrentContext.country_code = requestedCurrentContext.country_code`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.country_code = requestedCurrentContext.country_code THEN ${weight} ELSE 0 END`,
  },

  city_name: {
    startPattern: `MATCH (c:Context {city_name: $value})`,
    strict: `dbCurrentContext.city_name = requestedCurrentContext.city_name`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.city_name = requestedCurrentContext.city_name THEN ${weight} ELSE 0 END`,
  },

  work_type: {
    startPattern: `MATCH (c:Context {work_type: $value})`,
    strict: `dbCurrentContext.work_type = requestedCurrentContext.work_type`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.work_type = requestedCurrentContext.work_type THEN ${weight} ELSE 0 END`,
  },

  company_size: {
    startPattern: `MATCH (c:Context {company_size: $value})`,
    strict: `dbCurrentContext.company_size = requestedCurrentContext.company_size`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.company_size = requestedCurrentContext.company_size THEN ${weight} ELSE 0 END`,
  },

  team_size: {
    startPattern: `MATCH (c:Context {team_size: $value})`,
    strict: `dbCurrentContext.team_size = requestedCurrentContext.team_size`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.team_size = requestedCurrentContext.team_size THEN ${weight} ELSE 0 END`,
  },

  birth_year: {
    startPattern: `MATCH (c:Context {birth_year: $value})`,
    strict: `dbCurrentContext.birth_year = requestedCurrentContext.birth_year`,
    flexible: (weight: number) =>
      `CASE WHEN dbCurrentContext.birth_year = requestedCurrentContext.birth_year THEN ${weight} ELSE 0 END`,
  },
} satisfies FieldSnippets;

export function buildStrictConditions(optimalOrder: ContextField[]): string {
  const conditions = optimalOrder
    .map((field) => {
      const snippet = FIELD_SNIPPETS[field];
      return snippet.strict;
    })
    .filter(Boolean);

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND\n  ")}` : "";
}

export function buildFlexibleScoring(
  flexiblePresets: FlexiblePreset[]
): string {
  const scores = flexiblePresets
    .map(({ field, weight }) => {
      const snippet = FIELD_SNIPPETS[field];
      return snippet.flexible(weight);
    })
    .filter(Boolean);

  return scores.length > 0
    ? `WITH *, (\n  ${scores.join(" +\n  ")}\n) AS compatibilityScore\nWHERE compatibilityScore > 0`
    : "";
}

