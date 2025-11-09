import { z } from "zod";
import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "../config.js";
import {
  UserIdSchema,
  ContextIdSchema,
  TrailIdSchema,
  UserContextSchema,
  NewContextReasonSchema,
  ScoredMatchedCandidateSchema,
  ScoredMatchedCandidateWithPathAndDTWSchema,
  MatchedCandidateWithPathSchema,
  UserContext,
  TargetContextSchema,
  ContextFieldSchema,
  SearchFiltersSchema,
  SearchByContextParamsSchema,
  StoryInputSchema,
  UpsertContextResultSchema,
  UpsertTrailResultSchema,
  UpsertStoryResultSchema,
} from "../shared/schemas.js";

// Re-export shared types for core use
export type {
  UserId,
  ContextId,
  TrailId,
  UserContext,
  NewContextReason,
  Trail,
  Schedule,
  UserConstraints,
  DTWMetrics,
  MatchedCandidate,
  ScoredMatchedCandidate,
  MatchedCandidateWithPath,
  ScoredMatchedCandidateWithPath,
  ScoredMatchedCandidateWithPathAndDTW,
  TargetContext,
  FilterMode,
  FieldFilter,
  ContextField,
  SearchFilters,
  SearchByContextParams,
  StoryInput,
  UpsertContextResult,
  UpsertTrailResult,
  UpsertStoryResult,
  Goal,
} from "../shared/schemas.js";

// Re-export schemas for validation
export {
  UserIdSchema,
  ContextIdSchema,
  TrailIdSchema,
  UserContextSchema,
  NewContextReasonSchema,
  TargetContextSchema,
  ContextFieldSchema,
  SearchFiltersSchema,
  SearchByContextParamsSchema,
  StoryInputSchema,
  UpsertContextResultSchema,
  UpsertTrailResultSchema,
  UpsertStoryResultSchema,
};

// ==========================================
// === CORE-SPECIFIC SEARCH SCHEMAS ===
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

// Target-specific search filters (extends base SearchFilters with criteria)
// Now uses TargetContext from Shared with discriminated union pattern
export const TargetSearchFiltersSchema = SearchFiltersSchema.extend({
  criteria: TargetContextSchema.describe("Target context criteria (FieldFilter with mode/values)"),
});

export type TargetSearchFilters = z.infer<typeof TargetSearchFiltersSchema>;

// DTW-specific filters (extends base SearchFilters with analysis limit)
export const DTWSearchFiltersSchema = SearchFiltersSchema.extend({
  analysisLimit: z
    .number()
    .min(1)
    .max(500)
    .default(100)
    .describe("Number of candidates to collect for DTW analysis (pre-filter)"),
});

export type DTWSearchFilters = z.infer<typeof DTWSearchFiltersSchema>;

// ==========================================
// === NEW SEARCH API PARAMS (Refactored) ===
// ==========================================

// Режим 2+3: User Search (автоматический DTW если есть траектория)
export const UserSearchParamsSchema = z.object({
  userId: UserIdSchema.describe("User ID (resolves context from DB)"),
  filters: SearchFiltersSchema,
  pathLimit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Final result limit after DTW (filters.limit = pre-filter before DTW)"),
});

export type UserSearchParams = z.infer<typeof UserSearchParamsSchema>;

// Режим 4: Target-Only Search (БЕЗ userId - нет reference context!)
export const TargetSearchParamsSchema = z.object({
  filters: TargetSearchFiltersSchema.describe("Target search filters with criteria (FieldFilter pattern)"),
});

export type TargetSearchParams = z.infer<typeof TargetSearchParamsSchema>;

// Use shared candidate schemas (imported above, re-exported for compatibility)

export const SkillPenaltySchema = z.object({
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

export type SkillPenalty = z.infer<typeof SkillPenaltySchema>;

export const SkillsAnalysisSchema = z.object({
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
    .array(SkillPenaltySchema)
    .describe("Detailed penalty breakdown per extra skill"),
});

export type SkillsAnalysis = z.infer<typeof SkillsAnalysisSchema>;

export const BasicSearchResultSchema = z.object({
  candidates: z.array(ScoredMatchedCandidateSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("context").describe("Search by user's current context"),
});

export type BasicSearchResult = z.infer<typeof BasicSearchResultSchema>;

export const PathSearchResultSchema = z.object({
  candidates: z.array(ScoredMatchedCandidateWithPathAndDTWSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("path").describe("Path search with DTW"),
});

export type PathSearchResult = z.infer<typeof PathSearchResultSchema>;

export const TargetOnlySearchResultSchema = z.object({
  candidates: z.array(MatchedCandidateWithPathSchema),
  totalCount: z.number().describe("Total number of candidates found"),
  searchMode: z.literal("target_only").describe("Reverse search by target"),
});

export type TargetOnlySearchResult = z.infer<
  typeof TargetOnlySearchResultSchema
>;

// ==========================================
// === REASONS (for AI recognition) ===
// ==========================================

export const ReasonSchema = z.object({
  reasonId: z.string().describe("Unique reason identifier"),
  description: z.string().describe("Human-readable description"),
  patterns: z.array(z.string()).describe("Patterns for AI recognition"),
  commonCombinations: z
    .array(z.string())
    .describe("Common combinations as comma-separated strings"),
  examples: z.array(z.string()).describe("Example usage"),
});

export type Reason = z.infer<typeof ReasonSchema>;

// ==========================================
// === LEGACY SEARCH TYPES (to be removed) ===
// ==========================================

export const SearchContextSchema = UserContextSchema.omit({
  contextId: true,
  createdAt: true,
  creationReason: true,
  previousContextId: true,
  nextContextId: true,
  birthYear: true,
  citizenships: true,
}).partial();

export const FlexibleFieldSchema = z.object({
  field: ContextFieldSchema,
  weight: z.number().min(0).max(100),
});

const FlexibleFieldsSchema = z
  .array(FlexibleFieldSchema)
  .refine(
    (fields) => fields.reduce((sum, field) => sum + field.weight, 0) === 100,
    {
      message: "Total weight of flexible fields must equal 100",
    }
  );

export const SearchConstraintsSchema = z.object({
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

export type SearchContext = z.infer<typeof SearchContextSchema>;
export type FlexibleField = z.infer<typeof FlexibleFieldSchema>;
export type SearchConstraints = z.infer<typeof SearchConstraintsSchema>;

// ==========================================
// === MCP TOOL PARAMETERS ===
// ==========================================

export const CurrentOnlyReasonParamsSchema = z.object({
  currentPreset: z.string().describe("Preset name for compatibility scoring"),
  currentContext: SearchContextSchema.describe(
    "User's current context (search params, all fields optional)"
  ),
  currentUserId: UserIdSchema.describe("User ID (to exclude from results)"),
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
  searchConstraints: SearchConstraintsSchema.describe(
    "Search constraints (results_limit, timing thresholds)"
  ),
});

export const TargetOnlyReasonParamsSchema = z.object({
  targetPreset: z
    .string()
    .describe("Preset name for target compatibility scoring"),
  targetContext: SearchContextSchema.describe(
    "User's target context (search params, all fields optional)"
  ),
  currentUserId: UserIdSchema.describe("User ID (to exclude from results)"),
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
  searchConstraints: SearchConstraintsSchema.describe(
    "Search constraints (results_limit, timing thresholds)"
  ),
});

export const GetUserStoryParamsSchema = z.object({
  userId: UserIdSchema,
});

export const DeleteContextParamsSchema = z.object({
  userId: UserIdSchema,
  contextId: ContextIdSchema,
});

export const DeleteTrailParamsSchema = z.object({
  userId: UserIdSchema,
  trailId: TrailIdSchema,
});

export type CurrentOnlyReasonParams = z.input<
  typeof CurrentOnlyReasonParamsSchema
>;
export type TargetOnlyReasonParams = z.input<
  typeof TargetOnlyReasonParamsSchema
>;
export type GetUserStoryParams = z.infer<typeof GetUserStoryParamsSchema>;
export type DeleteContextParams = z.infer<typeof DeleteContextParamsSchema>;
export type DeleteTrailParams = z.infer<typeof DeleteTrailParamsSchema>;

// ==========================================
// === SEARCH RESULTS ===
// ==========================================

export const ReasonCombinationSchema = z.object({
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
        userId: UserIdSchema,
        matchScore: z.number(),
      })
    )
    .describe("Sample users with this combination"),
});

export const CurrentOnlyReasonBasedResultSchema = z.object({
  lookaheadMonths: z.number().describe("Time period for lookahead"),
  totalCandidates: z.number().describe("Total number of candidates found"),
  reasonCombinations: z
    .array(ReasonCombinationSchema)
    .describe("Combinations grouped by creation_reason"),
});

export type ReasonCombination = z.infer<typeof ReasonCombinationSchema>;
export type CurrentOnlyReasonBasedResult = z.infer<
  typeof CurrentOnlyReasonBasedResultSchema
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

export const SkillCategoryIdSchema = z
  .string()
  .min(1)
  .describe("Skill category ID");

export const SkillCategorySchema = z.object({
  categoryId: SkillCategoryIdSchema,
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

export const SkillCategoryWithSkillsSchema = SkillCategorySchema.extend({
  skills: z.array(z.string()).describe("Skills assigned to this category"),
});

export const SkillCategoryTemplateSchema = z.object({
  categoryName: z.string(),
  weight: z.number().min(0).max(100),
  penaltyMultiplier: z.number().min(0),
  skills: z.array(z.string()),
});

export const DomainTemplateSchema = z.object({
  description: z.string(),
  categories: z.array(SkillCategoryTemplateSchema),
});

export const SkillCategoryTemplatesConfigSchema = z.object({
  templates: z.record(DomainTemplateSchema),
});

export const ListSkillCategoryTemplatesParamsSchema = z.object({});

export const ApplySkillCategoryTemplateParamsSchema = z.object({
  templateName: z
    .string()
    .describe("Template name (e.g., 'it_software', 'it_data_science')"),
  domainPrefix: z
    .string()
    .optional()
    .describe("Optional prefix for category IDs (e.g., 'company_name')"),
});

export const ListSkillCategoriesParamsSchema = z.object({
  templateName: z.string().optional().describe("Filter by template name"),
});

export const CreateCustomSkillCategoryParamsSchema = z.object({
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

export const AssignSkillToCategoryParamsSchema = z.object({
  skillName: z.string().describe("Skill name to assign"),
  categoryId: z.string().describe("Target category ID"),
});

export type SkillCategory = z.infer<typeof SkillCategorySchema>;
export type SkillCategoryWithSkills = z.infer<
  typeof SkillCategoryWithSkillsSchema
>;
export type SkillCategoryTemplate = z.infer<typeof SkillCategoryTemplateSchema>;
export type DomainTemplate = z.infer<typeof DomainTemplateSchema>;
export type SkillCategoryTemplatesConfig = z.infer<
  typeof SkillCategoryTemplatesConfigSchema
>;

// ==========================================
// === PRESET CONFIGS ===
// ==========================================

export const CurrentPresetConfigSchema = z.object({
  strictFields: z
    .array(ContextFieldSchema)
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
  flexibleFields: FlexibleFieldsSchema,
});

export const TargetPresetConfigSchema = z.object({
  strictFields: z.array(ContextFieldSchema),
  flexibleFields: FlexibleFieldsSchema,
});

export const CurrentPresetsSchema = z.record(CurrentPresetConfigSchema);
export const TargetPresetsSchema = z.record(TargetPresetConfigSchema);

export type QueryConfig =
  | z.infer<typeof CurrentPresetConfigSchema>
  | z.infer<typeof TargetPresetConfigSchema>;
