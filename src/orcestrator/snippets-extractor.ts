import { type ContextField, FlexiblePreset } from "../schemas-zod.js";

type FieldSnippet = {
  startPattern: string | ((value: any) => string);
  strict: (searchCtx: string, candidateCtx: string) => string;
  flexible: (searchCtx: string, candidateCtx: string, weight: number) => string;
};
type FieldSnippets = Record<ContextField, FieldSnippet>;

export const FIELD_SNIPPETS = {
  position: {
    startPattern: (_value: string) => `MATCH (c:Context {position: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.position = ${searchCtx}.position`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.position = ${searchCtx}.position THEN ${weight} ELSE 0 END`,
  },

  domains: {
    startPattern: (value: string[]) =>
      `MATCH (c:Context) WHERE ANY(d IN $value WHERE d IN c.domains)`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `all(d IN ${searchCtx}.domains WHERE d IN ${candidateCtx}.domains)`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN size([d IN ${searchCtx}.domains WHERE d IN ${candidateCtx}.domains]) > 0 
      THEN ${weight} * (toFloat(size([d IN ${searchCtx}.domains WHERE d IN ${candidateCtx}.domains])) / size(${searchCtx}.domains)) 
      ELSE 0 END`,
  },

  skills: {
    startPattern: (value: any[]) =>
      `MATCH (c:Context) WHERE ANY(s IN [skill IN $value | skill.name] WHERE s IN c.skills)`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `all(s IN [skill IN ${searchCtx}.skills | skill.name] WHERE s IN ${candidateCtx}.skills)`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN size([s IN [skill IN ${searchCtx}.skills | skill.name] WHERE s IN ${candidateCtx}.skills]) > 0 
      THEN ${weight} * (toFloat(size([s IN [skill IN ${searchCtx}.skills | skill.name] WHERE s IN ${candidateCtx}.skills])) / size(${searchCtx}.skills)) 
      ELSE 0 END`,
  },

  industry: {
    startPattern: (value: string) => `MATCH (c:Context {industry: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.industry = ${searchCtx}.industry`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.industry = ${searchCtx}.industry THEN ${weight} ELSE 0 END`,
  },

  country_code: {
    startPattern: (value: string) => `MATCH (c:Context {country_code: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.country_code = ${searchCtx}.country_code`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.country_code = ${searchCtx}.country_code THEN ${weight} ELSE 0 END`,
  },

  city_name: {
    startPattern: (value: string) => `MATCH (c:Context {city_name: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.city_name = ${searchCtx}.city_name`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.city_name = ${searchCtx}.city_name THEN ${weight} ELSE 0 END`,
  },

  work_type: {
    startPattern: (value: string) => `MATCH (c:Context {work_type: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.work_type = ${searchCtx}.work_type`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.work_type = ${searchCtx}.work_type THEN ${weight} ELSE 0 END`,
  },

  company_size: {
    startPattern: (value: string) => `MATCH (c:Context {company_size: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.company_size = ${searchCtx}.company_size`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.company_size = ${searchCtx}.company_size THEN ${weight} ELSE 0 END`,
  },

  team_size: {
    startPattern: (value: number) => `MATCH (c:Context {team_size: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.team_size = ${searchCtx}.team_size`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.team_size = ${searchCtx}.team_size THEN ${weight} ELSE 0 END`,
  },

  birth_year: {
    startPattern: (value: number) => `MATCH (c:Context {birth_year: $value})`,
    strict: (searchCtx: string, candidateCtx: string) =>
      `${candidateCtx}.birth_year = ${searchCtx}.birth_year`,
    flexible: (searchCtx: string, candidateCtx: string, weight: number) =>
      `CASE WHEN ${candidateCtx}.birth_year = ${searchCtx}.birth_year THEN ${weight} ELSE 0 END`,
  },
} satisfies FieldSnippets;

export function buildStrictConditions(
  optimalOrder: ContextField[],
  searchCtx: string,
  candidateCtx: string
): string {
  const conditions = optimalOrder
    .map((field) => {
      const snippet = FIELD_SNIPPETS[field];
      return snippet.strict(searchCtx, candidateCtx);
    })
    .filter(Boolean);

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND\n  ")}` : "";
}

export function buildFlexibleScoring(
  flexiblePresets: FlexiblePreset[],
  searchCtx: string,
  candidateCtx: string
): string {
  const scores = flexiblePresets
    .map(({ field, weight }) => {
      const snippet = FIELD_SNIPPETS[field];
      return snippet.flexible(searchCtx, candidateCtx, weight);
    })
    .filter(Boolean);

  return scores.length > 0
    ? `WITH *, (\n  ${scores.join(" +\n  ")}\n) AS compatibilityScore\nWHERE compatibilityScore > 0`
    : "";
}

export function buildQueryFromConfig(
  flexiblePresets: FlexiblePreset[],
  optimalOrder: ContextField[],
  searchCtx: string = "requestedContext",
  candidateCtx: string = "candidateContext"
): {
  whereClause: string;
  scoreClause: string;
} {
  const whereClause = buildStrictConditions(
    optimalOrder,
    searchCtx,
    candidateCtx
  );
  const scoreClause = buildFlexibleScoring(
    flexiblePresets,
    searchCtx,
    candidateCtx
  );

  return { whereClause, scoreClause };
}
