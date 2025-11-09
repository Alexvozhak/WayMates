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
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.position = ${ourVar}.position`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.position = ${ourVar}.position THEN ${weight} ELSE 0 END`,
  },

  domains: {
    startPattern: `MATCH (c:Context) WHERE ANY(d IN $domains WHERE d IN c.domains)`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `all(d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains)`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN size([d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains]) > 0
      THEN ${weight} * (toFloat(size([d IN ${ourVar}.domains WHERE d IN ${candidateVar}.domains])) / size(${ourVar}.domains))
      ELSE 0 END`,
  },

  skills: {
    startPattern: `MATCH (c:Context) WHERE ANY(s IN $skills WHERE s IN c.skills)`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `all(s IN ${ourVar}.skills WHERE s IN ${candidateVar}.skills)`,
    generateFlexible: (_weight: number, candidateVar: string, ourVar: string) => {
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
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.industry = ${ourVar}.industry`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.industry = ${ourVar}.industry THEN ${weight} ELSE 0 END`,
  },

  countryCode: {
    startPattern: `MATCH (c:Context {country_code: $value})`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.country_code = ${ourVar}.country_code`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.country_code = ${ourVar}.country_code THEN ${weight} ELSE 0 END`,
  },

  cityName: {
    startPattern: `MATCH (c:Context {city_name: $value})`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.city_name = ${ourVar}.city_name`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.city_name = ${ourVar}.city_name THEN ${weight} ELSE 0 END`,
  },

  companySize: {
    startPattern: `MATCH (c:Context {company_size: $value})`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.company_size = ${ourVar}.company_size`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.company_size = ${ourVar}.company_size THEN ${weight} ELSE 0 END`,
  },

  birthYear: {
    startPattern: `MATCH (c:Context {birth_year: $value})`,
    generateStrict: (candidateVar: string, ourVar: string) =>
      `${candidateVar}.birth_year = ${ourVar}.birth_year`,
    generateFlexible: (weight: number, candidateVar: string, ourVar: string) =>
      `CASE WHEN ${candidateVar}.birth_year = ${ourVar}.birth_year THEN ${weight} ELSE 0 END`,
  },
} as const satisfies Record<ContextField, FieldSnippet>;

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

const GOAL_FIELDS = ["positions", "countries", "domains", "skills"] as const;

type GoalField = (typeof GOAL_FIELDS)[number];

const GOAL_FIELD_MAPPING: Record<
  GoalField,
  { contextField: string; isArray: boolean }
> = {
  positions: { contextField: "position", isArray: false },
  countries: { contextField: "countryCode", isArray: false },
  domains: { contextField: "domains", isArray: true },
  skills: { contextField: "skills", isArray: true },
};

export function buildGoalFilterConditions(
  contextVarName = "c"
): string {
  const desiredConditions = GOAL_FIELDS.map((field) => {
    const mapping = GOAL_FIELD_MAPPING[field];
    if (mapping.isArray) {
      return `($desired.${field} IS NULL OR ANY(v IN $desired.${field} WHERE v IN ${contextVarName}.${mapping.contextField}))`;
    }
    return `($desired.${field} IS NULL OR ANY(v IN $desired.${field} WHERE ${contextVarName}.${mapping.contextField} = v))`;
  });

  const undesiredConditions = GOAL_FIELDS.map((field) => {
    const mapping = GOAL_FIELD_MAPPING[field];
    if (mapping.isArray) {
      return `($undesired.${field} IS NULL OR NONE(v IN $undesired.${field} WHERE v IN ${contextVarName}.${mapping.contextField}))`;
    }
    return `($undesired.${field} IS NULL OR NONE(v IN $undesired.${field} WHERE ${contextVarName}.${mapping.contextField} = v))`;
  });

  const allConditions = desiredConditions.concat(undesiredConditions);
  return allConditions.join(" AND\n  ");
}

