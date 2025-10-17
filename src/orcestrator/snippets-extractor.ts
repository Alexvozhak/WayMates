import { type ContextField, type FlexibleField } from "../schemas-zod.js";

type FieldSnippet = {
  startPattern: string;
  // Семантические имена: candidateContext (кандидат из БД) vs ourContext (наш параметр)
  generateStrict: (candidateVar: string, ourVar: string) => string;
  generateFlexible: (
    weight: number,
    candidateVar: string,
    ourVar: string
  ) => string;
};

export const FIELD_SNIPPETS: Record<ContextField, FieldSnippet> = {
  position: {
    startPattern: `MATCH (c:Context {position: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.position = ${ourVar}.position`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.position = ${ourVar}.position THEN ${weight} ELSE 0 END`,
  },

  domains: {
    startPattern: `MATCH (c:Context) WHERE ANY(d IN $domains WHERE d IN c.domains)`,
    generateStrict: (candidateVar, ourVar) =>
      `all(d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains)`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN size([d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains]) > 0 
      THEN ${weight} * (toFloat(size([d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains])) / size(${ourVar}.domains)) 
      ELSE 0 END`,
  },

  skills: {
    startPattern: `MATCH (c:Context) WHERE ANY(s IN $skills WHERE s IN c.skills)`,
    generateStrict: (candidateVar, ourVar) =>
      `all(s IN ${ourVar}.skills WHERE s IN ${candidateVar}.skills)`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN size([s IN ${ourVar}.skills WHERE s IN ${candidateVar}.skills]) > 0 
      THEN ${weight} * (toFloat(size([s IN ${ourVar}.skills WHERE s IN ${candidateVar}.skills])) / size(${ourVar}.skills)) 
      ELSE 0 END`,
  },

  industry: {
    startPattern: `MATCH (c:Context {industry: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.industry = ${ourVar}.industry`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.industry = ${ourVar}.industry THEN ${weight} ELSE 0 END`,
  },

  country_code: {
    startPattern: `MATCH (c:Context {country_code: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.country_code = ${ourVar}.country_code`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.country_code = ${ourVar}.country_code THEN ${weight} ELSE 0 END`,
  },

  city_name: {
    startPattern: `MATCH (c:Context {city_name: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.city_name = ${ourVar}.city_name`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.city_name = ${ourVar}.city_name THEN ${weight} ELSE 0 END`,
  },

  work_type: {
    startPattern: `MATCH (c:Context {work_type: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.work_type = ${ourVar}.work_type`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.work_type = ${ourVar}.work_type THEN ${weight} ELSE 0 END`,
  },

  company_size: {
    startPattern: `MATCH (c:Context {company_size: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.company_size = ${ourVar}.company_size`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.company_size = ${ourVar}.company_size THEN ${weight} ELSE 0 END`,
  },

  team_size: {
    startPattern: `MATCH (c:Context {team_size: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.team_size = ${ourVar}.team_size`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.team_size = ${ourVar}.team_size THEN ${weight} ELSE 0 END`,
  },

  birth_year: {
    startPattern: `MATCH (c:Context {birth_year: $value})`,
    generateStrict: (candidateVar, ourVar) =>
      `${candidateVar}.birth_year = ${ourVar}.birth_year`,
    generateFlexible: (weight, candidateVar, ourVar) =>
      `CASE WHEN ${candidateVar}.birth_year = ${ourVar}.birth_year THEN ${weight} ELSE 0 END`,
  },
} as const satisfies Record<ContextField, FieldSnippet>;

// === NEO4J 5+ СПЕЦИАЛИЗИРОВАННЫЕ ФУНКЦИИ ===

/** Current Context Search - candidateContext (из БД) vs ourCurrentContext */
export function buildCurrentContextStrictConditions(
  strictFields: ContextField[]
): string {
  const conditions = strictFields
    .map((field) =>
      FIELD_SNIPPETS[field].generateStrict(
        "candidateContext",
        "$currentContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

export function buildCurrentContextFlexibleConditions(
  flexibleFields: FlexibleField[]
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) =>
      FIELD_SNIPPETS[field].generateFlexible(
        weight,
        "candidateContext",
        "$currentContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0
    ? `(\n  ${conditions.join(" +\n  ")}\n) AS contextCompatibilityScore\nWHERE contextCompatibilityScore > 0`
    : `0 AS contextCompatibilityScore`;
}

/** Target Context Search - candidateContext (из БД) vs ourTargetContext */
export function buildTargetContextStrictConditions(
  strictFields: ContextField[]
): string {
  const conditions = strictFields
    .map((field) =>
      FIELD_SNIPPETS[field].generateStrict("candidateContext", "$targetContext")
    )
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

export function buildTargetContextFlexibleConditions(
  flexibleFields: FlexibleField[]
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) =>
      FIELD_SNIPPETS[field].generateFlexible(
        weight,
        "candidateContext",
        "$targetContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0
    ? `(\n  ${conditions.join(" +\n  ")}\n) AS contextCompatibilityScore\nWHERE contextCompatibilityScore > 0`
    : `0 AS contextCompatibilityScore`;
}

/** Pipeline Current Context - candidateCurrentContext (из БД) vs ourCurrentContext */
export function buildPipelineCurrentStrictConditions(
  strictFields: ContextField[]
): string {
  const conditions = strictFields
    .map((field) =>
      FIELD_SNIPPETS[field].generateStrict(
        "candidateCurrentContext",
        "$currentContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

export function buildPipelineCurrentFlexibleConditions(
  flexibleFields: FlexibleField[]
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) =>
      FIELD_SNIPPETS[field].generateFlexible(
        weight,
        "candidateCurrentContext",
        "$currentContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0
    ? `(\n  ${conditions.join(" +\n  ")}\n) AS currentContextCompatibilityScore\nWHERE currentContextCompatibilityScore > 0`
    : `0 AS currentContextCompatibilityScore`;
}

/** Pipeline Target Context - candidateTargetContext (из БД) vs ourTargetContext */
export function buildPipelineTargetStrictConditions(
  strictFields: ContextField[]
): string {
  const conditions = strictFields
    .map((field) =>
      FIELD_SNIPPETS[field].generateStrict(
        "candidateTargetContext",
        "$targetContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

export function buildPipelineTargetFlexibleConditions(
  flexibleFields: FlexibleField[]
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) =>
      FIELD_SNIPPETS[field].generateFlexible(
        weight,
        "candidateTargetContext",
        "$targetContext"
      )
    )
    .filter(Boolean);
  return conditions.length > 0
    ? `(\n  ${conditions.join(" +\n  ")}\n) AS targetContextCompatibilityScore\nWHERE targetContextCompatibilityScore > 0`
    : `0 AS targetContextCompatibilityScore`;
}
