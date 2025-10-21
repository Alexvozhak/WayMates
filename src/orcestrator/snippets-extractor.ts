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
    generateFlexible: (_weight, candidateVar, ourVar) => {
      // NOTE: Игнорируем переданный weight - используем веса из категорий в БД
      // Scoring происходит через категории навыков с penalty за лишние skills
      return `
        // === SKILLS SCORING WITH CATEGORIES ===
        // 1. Matched skills (intersection)
        WITH *, [skill IN ${ourVar}.skills WHERE skill IN ${candidateVar}.skills] AS matchedSkills

        // 2. Extra skills (candidate has but we don't need)
        WITH *, [skill IN ${candidateVar}.skills WHERE NOT skill IN ${ourVar}.skills] AS extraSkills

        // 3. Get weights from categories for matched skills
        CALL {
          WITH matchedSkills
          UNWIND matchedSkills AS matchedSkill
          OPTIONAL MATCH (s:Skill {name: matchedSkill})-[:BELONGS_TO]->(sc:SkillCategory)
          RETURN collect({
            skill: matchedSkill,
            weight: coalesce(sc.weight, 5.0)
          }) AS matchedSkillsWithWeights
        }

        // 4. Get penalties from categories for extra skills
        CALL {
          WITH extraSkills
          UNWIND extraSkills AS extraSkill
          OPTIONAL MATCH (s:Skill {name: extraSkill})-[:BELONGS_TO]->(sc:SkillCategory)
          RETURN collect({
            skill: extraSkill,
            penalty: coalesce(sc.penalty_multiplier, 1.0)
          }) AS extraSkillsWithPenalty
        }

        // 5. Calculate final score (positive - penalty)
        WITH *,
          reduce(positiveScore = 0.0, matched IN matchedSkillsWithWeights |
            positiveScore + matched.weight
          ) AS skillsPositiveScore,
          reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
            penaltyScore + extra.penalty
          ) AS skillsPenaltyScore

        WITH *, (skillsPositiveScore - skillsPenaltyScore) AS skillsScore
      `.trim();
    },
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

// === UNIVERSAL BUILDER FUNCTIONS ===

/**
 * Build strict WHERE conditions for context matching
 * @param strictFields - Fields to match strictly
 * @param dbVarName - Database variable name (e.g., "candidateContext", "matchedContext")
 * @param paramName - Query parameter name (e.g., "$searchContext", "$currentContext")
 */
export function buildContextStrictConditions(
  strictFields: ContextField[],
  dbVarName: string = "candidateContext",
  paramName: string = "$searchContext"
): string {
  const conditions = strictFields
    .map((field) => FIELD_SNIPPETS[field].generateStrict(dbVarName, paramName))
    .filter(Boolean);
  return conditions.length > 0 ? conditions.join(" AND\n  ") : "";
}

/**
 * Build flexible scoring conditions for context compatibility
 * @param flexibleFields - Fields with weights for scoring
 * @param dbVarName - Database variable name
 * @param paramName - Query parameter name
 * @param scoreAlias - Alias for the calculated score
 */
export function buildContextFlexibleConditions(
  flexibleFields: FlexibleField[],
  dbVarName: string = "candidateContext",
  paramName: string = "$searchContext",
  scoreAlias: string = "contextCompatibilityScore"
): string {
  const conditions = flexibleFields
    .map(({ field, weight }) =>
      FIELD_SNIPPETS[field].generateFlexible(weight, dbVarName, paramName)
    )
    .filter(Boolean);
  return conditions.length > 0
    ? `(\n  ${conditions.join(" +\n  ")}\n) AS ${scoreAlias}\nWHERE ${scoreAlias} > 0`
    : `0 AS ${scoreAlias}`;
}

