import { type ContextField, type FlexibleField } from "../schemas-zod.js";

type FieldSnippet = {
  startPattern: string;
  strict: () => string;
  flexible: (weight: number) => string;
};

export const FIELD_SNIPPETS: Record<ContextField, FieldSnippet> = {
  position: {
    startPattern: `MATCH (c:Context {position: $value})`,
    strict: () => `dbContext.position = requestedContext.position`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.position = requestedContext.position THEN ${weight} ELSE 0 END`,
  },

  domains: {
    startPattern: `MATCH (c:Context) WHERE ANY(d IN $domains WHERE d IN c.domains)`,
    strict: () =>
      `all(d IN requestedContext.domains WHERE d IN dbContext.domains)`,
    flexible: (weight: number) =>
      `CASE WHEN size([d IN requestedContext.domains WHERE d IN dbContext.domains]) > 0 
      THEN ${weight} * (toFloat(size([d IN requestedContext.domains WHERE d IN dbContext.domains])) / size(requestedContext.domains)) 
      ELSE 0 END`,
  },

  skills: {
    startPattern: `MATCH (c:Context) WHERE ANY(s IN $skills WHERE s IN c.skills)`,
    strict: () =>
      `all(s IN requestedContext.skills WHERE s.name IN dbContext.skills)`,
    flexible: (weight: number) =>
      `CASE WHEN size([s IN requestedContext.skills WHERE s.name IN dbContext.skills]) > 0 
      THEN ${weight} * (toFloat(size([s IN requestedContext.skills WHERE s.name IN dbContext.skills])) / size(requestedContext.skills)) 
      ELSE 0 END`,
  },

  industry: {
    startPattern: `MATCH (c:Context {industry: $value})`,
    strict: () => `dbContext.industry = requestedContext.industry`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.industry = requestedContext.industry THEN ${weight} ELSE 0 END`,
  },

  country_code: {
    startPattern: `MATCH (c:Context {country_code: $value})`,
    strict: () => `dbContext.country_code = requestedContext.country_code`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.country_code = requestedContext.country_code THEN ${weight} ELSE 0 END`,
  },

  city_name: {
    startPattern: `MATCH (c:Context {city_name: $value})`,
    strict: () => `dbContext.city_name = requestedContext.city_name`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.city_name = requestedContext.city_name THEN ${weight} ELSE 0 END`,
  },

  work_type: {
    startPattern: `MATCH (c:Context {work_type: $value})`,
    strict: () => `dbContext.work_type = requestedContext.work_type`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.work_type = requestedContext.work_type THEN ${weight} ELSE 0 END`,
  },

  company_size: {
    startPattern: `MATCH (c:Context {company_size: $value})`,
    strict: () => `dbContext.company_size = requestedContext.company_size`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.company_size = requestedContext.company_size THEN ${weight} ELSE 0 END`,
  },

  team_size: {
    startPattern: `MATCH (c:Context {team_size: $value})`,
    strict: () => `dbContext.team_size = requestedContext.team_size`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.team_size = requestedContext.team_size THEN ${weight} ELSE 0 END`,
  },

  birth_year: {
    startPattern: `MATCH (c:Context {birth_year: $value})`,
    strict: () => `dbContext.birth_year = requestedContext.birth_year`,
    flexible: (weight: number) =>
      `CASE WHEN dbContext.birth_year = requestedContext.birth_year THEN ${weight} ELSE 0 END`,
  },
} as const satisfies Record<ContextField, FieldSnippet>;

export function buildStrictConditions(strictFields: ContextField[]): string {
  const conditions = strictFields
    .map((field) => FIELD_SNIPPETS[field].strict())
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

export function buildFlexibleConditions(
  flexibleFields: FlexibleField[]
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) => FIELD_SNIPPETS[field].flexible(weight))
    .filter(Boolean);
  return conditions.length > 0
    ? `WITH *, (\n  ${conditions.join(" +\n  ")}\n) AS contextCompatibilityScore\nWHERE contextCompatibilityScore > 0`
    : `WITH *, 0 AS contextCompatibilityScore`;
}
