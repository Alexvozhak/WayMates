import { z } from "zod";

import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "../config.js";
import {

  contextFieldSchema,
  contextIdSchema,
  matchedCandidateWithPathSchema,

  scoredMatchedCandidateSchema,
  scoredMatchedCandidateWithPathAndDTWSchema,



  trailIdSchema,



  userContextSchema,
  userIdSchema,

} from "../shared/schemas.js";

import type {
  UserContext} from "../shared/schemas.js";

// Re-export shared types for core use
export type {
  AdhocSearchParams,
  ContextField,
  ContextId,
  DTWMetrics,
  FieldFilter,
  FilterMode,
  Goal,
  MatchedCandidate,
  MatchedCandidateWithPath,
  NewContextReason,
  Schedule,
  ScoredMatchedCandidate,
  ScoredMatchedCandidateWithPath,
  ScoredMatchedCandidateWithPathAndDTW,
  StoryInput,
  TargetContext,
  TargetSearchParams,
  Trail,
  TrailId,
  UpsertContextResult,
  UpsertStoryResult,
  UpsertTrailResult,
  UserConstraints,
  UserContext,
  UserId,
  UserSearchParams,
} from "../shared/schemas.js";

// Re-export schemas for validation


// ==========================================
// === CORE-SPECIFIC CONSTANTS ===
// ==========================================

// Context field names - used for type validation
export const CONTEXT_FIELD_NAMES = [
  "position",
  "domains",
  "skills",
  "industry",
  "countryCode",
  "cityName",
  "companySize",
  "birthYear",
] as const satisfies readonly (keyof UserContext)[];

export const skillPenaltySchema = z.object({
  skill: z.string().describe("Skill name"),
  categoryName: z
    .string()
    .nullable()
    .describe("Category this skill belongs to"),
  weight: z
    .number()
    .min(0)
    .max(100)
    .describe("Weight for this skill (from category or default 5.0)"),
  penaltyMultiplier: z
    .number()
    .min(0)
    .describe("Penalty multiplier (from category or default 1.0)"),
  penaltyScore: z
    .number()
    .describe("Calculated penalty: weight * penaltyMultiplier"),
});

export type SkillPenalty = z.infer<typeof skillPenaltySchema>;

export const skillsAnalysisSchema = z.object({
  matchedSkills: z
    .array(z.string())
    .describe("Skills that match user requirements"),
  extraSkills: z
    .array(z.string())
    .describe("Skills candidate has but user doesn't need"),
  totalPenalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Total penalty normalized to 0-1 (sum / 100)"),
  penalties: z
    .array(skillPenaltySchema)
    .describe("Detailed penalty breakdown per extra skill"),
});

export type SkillsAnalysis = z.infer<typeof skillsAnalysisSchema>;

export const basicSearchResultSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("context").describe("Search by user's current context"),
});

export type BasicSearchResult = z.infer<typeof basicSearchResultSchema>;

export const pathSearchResultSchema = z.object({
  candidates: z.array(scoredMatchedCandidateWithPathAndDTWSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("path").describe("Path search with DTW"),
});

export type PathSearchResult = z.infer<typeof pathSearchResultSchema>;

export const targetOnlySearchResultSchema = z.object({
  candidates: z.array(matchedCandidateWithPathSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("target_only").describe("Reverse search by target"),
});

export type TargetOnlySearchResult = z.infer<
  typeof targetOnlySearchResultSchema
>;

// ==========================================
// === REASONS (for AI recognition) ===
// ==========================================

export const reasonSchema = z.object({
  reasonId: z.string().describe("Unique reason identifier"),
  description: z.string().describe("Human-readable description"),
  patterns: z.array(z.string()).describe("Patterns for AI recognition"),
  commonCombinations: z
    .array(z.string())
    .describe("Common combinations as comma-separated strings"),
  examples: z.array(z.string()).describe("Example usage"),
});

export type Reason = z.infer<typeof reasonSchema>;

// ==========================================
// === LEGACY SEARCH TYPES (to be removed) ===
// ==========================================

export const searchContextSchema = userContextSchema.omit({
  contextId: true,
  createdAt: true,
  creationReason: true,
  previousContextId: true,
  nextContextId: true,
  birthYear: true,
  citizenships: true,
}).partial();

export const flexibleFieldSchema = z.object({
  field: contextFieldSchema,
  weight: z.number().min(0).max(100),
});

const flexibleFieldsSchema = z
  .array(flexibleFieldSchema)
  .refine(
    (fields) => fields.reduce((sum, field) => sum + field.weight, 0) === 100,
    {
      message: "Total weight of flexible fields must equal 100",
    }
  );

export const searchConstraintsSchema = z.object({
  maxTimingDiffMonths: z.number().describe("Relevance within N months"),
  timingDiffThresholdPercent: z
    .number()
    .describe("Percentage threshold for timing filtering"),
  maxExperienceDiffMonths: z
    .number()
    .describe("Maximum experience difference in months"),
  resultsLimit: z
    .number()
    .min(1)
    .max(20)
    .describe("Results limit for Cypher LIMIT (must be between 1 and 20)"),
  minExperienceMonths: z
    .number()
    .describe("Minimum work experience")
    .optional(),
  maxExperienceMonths: z
    .number()
    .describe("Maximum work experience")
    .optional(),
  requiredSkills: z.array(z.string()).default([]).describe("Required skills"),
});

export type SearchContext = z.infer<typeof searchContextSchema>;
export type FlexibleField = z.infer<typeof flexibleFieldSchema>;
export type SearchConstraints = z.infer<typeof searchConstraintsSchema>;

// ==========================================
// === MCP TOOL PARAMETERS ===
// ==========================================

export const currentOnlyReasonParamsSchema = z.object({
  currentPreset: z.string().describe("Preset name for compatibility scoring"),
  currentContext: searchContextSchema.describe(
    "User's current context (search params, all fields optional)"
  ),
  currentUserId: userIdSchema.describe("User ID (to exclude from results)"),
  searchPeriodMonths: z
    .number()
    .min(1)
    .max(60)
    .describe(
      "Search period in months (forward lookahead, typically 6/12/18/24)"
    ),
  requiredReasons: z
    .array(z.string())
    .max(10)
    .optional()
    .default([])
    .describe("Required reasons (must have ALL, max 10)"),
  excludedReasons: z
    .array(z.string())
    .max(10)
    .optional()
    .default([])
    .describe("Excluded reasons (must have NONE, max 10)"),
  searchConstraints: searchConstraintsSchema.describe(
    "Search constraints (results_limit, timing thresholds)"
  ),
});

export const targetOnlyReasonParamsSchema = z.object({
  targetPreset: z
    .string()
    .describe("Preset name for target compatibility scoring"),
  targetContext: searchContextSchema.describe(
    "User's target context (search params, all fields optional)"
  ),
  currentUserId: userIdSchema.describe("User ID (to exclude from results)"),
  searchPeriodMonths: z
    .number()
    .min(1)
    .max(60)
    .describe(
      "Search period in months (backward lookback, typically 6/12/18/24)"
    ),
  requiredReasons: z
    .array(z.string())
    .max(10)
    .optional()
    .default([])
    .describe("Required reasons (must have ALL, max 10)"),
  excludedReasons: z
    .array(z.string())
    .max(10)
    .optional()
    .default([])
    .describe("Excluded reasons (must have NONE, max 10)"),
  searchConstraints: searchConstraintsSchema.describe(
    "Search constraints (results_limit, timing thresholds)"
  ),
});

export const getUserStoryParamsSchema = z.object({
  userId: userIdSchema,
});

export const deleteContextParamsSchema = z.object({
  userId: userIdSchema,
  contextId: contextIdSchema,
});

export const deleteTrailParamsSchema = z.object({
  userId: userIdSchema,
  trailId: trailIdSchema,
});

export type CurrentOnlyReasonParams = z.input<
  typeof currentOnlyReasonParamsSchema
>;
export type TargetOnlyReasonParams = z.input<
  typeof targetOnlyReasonParamsSchema
>;
export type GetUserStoryParams = z.infer<typeof getUserStoryParamsSchema>;
export type DeleteContextParams = z.infer<typeof deleteContextParamsSchema>;
export type DeleteTrailParams = z.infer<typeof deleteTrailParamsSchema>;

// ==========================================
// === SEARCH RESULTS ===
// ==========================================

export const reasonCombinationSchema = z.object({
  combination: z
    .array(z.string())
    .describe("Array of reason_ids in this combination"),
  usersCount: z
    .number()
    .describe("Total number of users with this combination"),
  stats: z.object({
    avgDurationMonths: z
      .number()
      .describe("Average duration to reach future context"),
    medianDurationMonths: z.number().describe("Median duration in months"),
    targetPositions: z
      .array(
        z.object({
          position: z.string(),
          count: z.number(),
        })
      )
      .describe("Array of position frequency objects"),
    commonSkillsGained: z
      .array(z.string())
      .describe("Most common skills gained"),
    avgCoursesTaken: z
      .number()
      .optional()
      .describe("Average number of courses/trails"),
    avgInvestmentUsd: z
      .number()
      .optional()
      .describe("Average investment in learning"),
  }),
  sampleUsers: z
    .array(
      z.object({
        userId: userIdSchema,
        matchScore: z.number(),
      })
    )
    .describe("Sample users with this combination"),
});

export const currentOnlyReasonBasedResultSchema = z.object({
  lookaheadMonths: z.number().describe("Time period for lookahead"),
  totalCandidates: z.number().describe("Total number of candidates found"),
  reasonCombinations: z
    .array(reasonCombinationSchema)
    .describe("Combinations grouped by creation_reason"),
});

export type ReasonCombination = z.infer<typeof reasonCombinationSchema>;
export type CurrentOnlyReasonBasedResult = z.infer<
  typeof currentOnlyReasonBasedResultSchema
>;

// ==========================================
// === PERSISTENCE ===
// ==========================================

// === MOVED: Re-export from shared schemas ===
// StoryInputSchema
// UpsertContextResultSchema
// UpsertTrailResultSchema
// UpsertStoryResultSchema
// See imports at top of file

// Types are now imported from shared/schemas.js above
// (previously defined locally, now using single source of truth)

// ==========================================
// === SKILL CATEGORIES ===
// ==========================================

export const skillCategoryIdSchema = z
  .string()
  .min(1)
  .describe("Skill category ID");

export const skillCategorySchema = z.object({
  categoryId: skillCategoryIdSchema,
  templateName: z.string().describe("Template this category belongs to"),
  categoryName: z.string().describe("Human-readable category name"),
  weight: z.number().min(0).max(100).describe("Weight for positive scoring"),
  penaltyMultiplier: z
    .number()
    .min(0)
    .describe("Multiplier for penalty scoring"),
  isPredefined: z
    .boolean()
    .describe("Whether category is from predefined template"),
  createdAt: z.string().describe("ISO 8601 datetime"),
});

export const skillCategoryWithSkillsSchema = skillCategorySchema.extend({
  skills: z.array(z.string()).describe("Skills assigned to this category"),
});

export const skillCategoryTemplateSchema = z.object({
  categoryName: z.string(),
  weight: z.number().min(0).max(100),
  penaltyMultiplier: z.number().min(0),
  skills: z.array(z.string()),
});

export const domainTemplateSchema = z.object({
  description: z.string(),
  categories: z.array(skillCategoryTemplateSchema),
});

export const skillCategoryTemplatesConfigSchema = z.object({
  templates: z.record(domainTemplateSchema),
});

export const listSkillCategoryTemplatesParamsSchema = z.object({});

export const applySkillCategoryTemplateParamsSchema = z.object({
  templateName: z
    .string()
    .describe("Template name (e.g., 'it_software', 'it_data_science')"),
  domainPrefix: z
    .string()
    .optional()
    .describe("Optional prefix for category IDs (e.g., 'company_name')"),
});

export const listSkillCategoriesParamsSchema = z.object({
  templateName: z.string().optional().describe("Filter by template name"),
});

export const createCustomSkillCategoryParamsSchema = z.object({
  categoryName: z.string().describe("Human-readable category name"),
  description: z.string().describe("Category description"),
  weight: z.number().min(0).max(100).describe("Weight for positive scoring"),
  penaltyMultiplier: z
    .number()
    .min(0)
    .describe("Multiplier for penalty scoring"),
  skills: z.array(z.string()).describe("List of skill names to assign"),
  templateName: z
    .string()
    .optional()
    .describe("Associate with template (optional)"),
});

export const assignSkillToCategoryParamsSchema = z.object({
  skillName: z.string().describe("Skill name to assign"),
  categoryId: z.string().describe("Target category ID"),
});

export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type SkillCategoryWithSkills = z.infer<
  typeof skillCategoryWithSkillsSchema
>;
export type SkillCategoryTemplate = z.infer<typeof skillCategoryTemplateSchema>;
export type DomainTemplate = z.infer<typeof domainTemplateSchema>;
export type SkillCategoryTemplatesConfig = z.infer<
  typeof skillCategoryTemplatesConfigSchema
>;

// ==========================================
// === PRESET CONFIGS ===
// ==========================================

export const currentPresetConfigSchema = z.object({
  strictFields: z
    .array(contextFieldSchema)
    .refine(
      (fields) =>
        REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.every((required) =>
          fields.includes(required)
        ),
      {
        message:
          "Current presets must include position, domains, skills in strictFields",
      }
    ),
  flexibleFields: flexibleFieldsSchema,
});

export const targetPresetConfigSchema = z.object({
  strictFields: z.array(contextFieldSchema),
  flexibleFields: flexibleFieldsSchema,
});

export const currentPresetsSchema = z.record(currentPresetConfigSchema);
export const targetPresetsSchema = z.record(targetPresetConfigSchema);

export type QueryConfig =
  | z.infer<typeof currentPresetConfigSchema>
  | z.infer<typeof targetPresetConfigSchema>;

export { adhocSearchParamsSchema, contextFieldSchema, contextIdSchema, newContextReasonSchema, storyInputSchema, targetContextSchema, targetSearchParamsSchema, trailIdSchema, upsertContextResultSchema, upsertStoryResultSchema, upsertTrailResultSchema, userContextSchema, userIdSchema, userSearchParamsSchema } from "../shared/schemas.js";