import { z } from "zod";
import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "../config.js";
import { REASON_IDS } from "../../database/reasons.js";
import {
  UserIdSchema as SharedUserIdSchema,
  UserContextSchema as SharedUserContextSchema,
  TargetContextSchema as SharedTargetContextSchema,
  NewContextReasonSchema as SharedNewContextReasonSchema,
} from "../shared/schemas.js";

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

export const ISO_8601_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$";

export const UUID_V7_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const USER_ID_PATTERN = `^usr_${UUID_V7_PATTERN}$`;
export const CONTEXT_ID_PATTERN = `^ctx_${UUID_V7_PATTERN}$`;
export const TRAIL_ID_PATTERN = `^trl_${UUID_V7_PATTERN}$`;

export const UserIdSchema = z
  .string()
  .regex(new RegExp(USER_ID_PATTERN), "User ID must be in format usr_<UUID>")
  .describe("User ID in format usr_<UUID>");

export const ContextIdSchema = z
  .string()
  .regex(
    new RegExp(CONTEXT_ID_PATTERN),
    "Context ID must be in format ctx_<UUID>"
  )
  .describe("Context ID in format ctx_<UUID>");

export const TrailIdSchema = z
  .string()
  .regex(new RegExp(TRAIL_ID_PATTERN), "Trail ID must be in format trl_<UUID>")
  .describe("Trail ID in format trl_<UUID>");

export type UserId = z.infer<typeof UserIdSchema>;
export type ContextId = z.infer<typeof ContextIdSchema>;
export type TrailId = z.infer<typeof TrailIdSchema>;

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const PositionSchema = z.string().min(1);
export const NewContextReasonSchema = z.enum(REASON_IDS);

export type Position = z.infer<typeof PositionSchema>;
export type NewContextReason = z.infer<typeof NewContextReasonSchema>;

export const ScheduleSchema = z.object({
  sessions_per_week: z.number().describe("Sessions per week"),
  hours_per_session: z.number().describe("Hours per session"),
});

export const TrailSchema = z.object({
  skill: z.string().describe("Skill being developed"),
  platform: z.string().describe("Learning platform used"),
  from_context_id: ContextIdSchema,
  to_context_id: z
    .union([ContextIdSchema, z.null().describe("null for ongoing trails")])
    .describe("Target context ID - string for completed, null for ongoing"),
  total_duration_weeks: z.number().describe("Total duration in weeks"),
  schedule: ScheduleSchema,
  cost_usd: z.number().describe("Cost in USD"),
  rating_course: z.number().min(1).max(5).describe("Course rating 1-5"),
  rating_platform: z.number().min(1).max(5).describe("Platform rating 1-5"),
  rating_schedule: z.number().min(1).max(5).describe("Schedule rating 1-5"),
  course_name: z.string().describe("Course name").optional(),
  course_link: z.string().describe("Course URL").optional(),
  user_feedback: z.string().describe("User feedback").optional(),
});

export const UserConstraintsSchema = z.object({
  max_hours_per_week: z.number().describe("Maximum hours per week").optional(),
  max_monthly_budget: z
    .number()
    .describe("Maximum monthly budget in USD")
    .optional(),
  deadline_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline date must be in YYYY-MM-DD format")
    .describe("Deadline date in YYYY-MM-DD format")
    .optional(),
});

export const UserContextSchema = z.object({
  context_id: z.string(),
  previous_context_id: ContextIdSchema.nullable().optional(),
  next_context_id: ContextIdSchema.nullable().optional(),
  created_at: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creation_reason: z
    .array(NewContextReasonSchema)
    .min(1)
    .describe(
      "Reasons for context creation (always required, use 'started_working' for first job)"
    ),
  position: PositionSchema,
  domains: z.array(z.string()).min(1).describe("Work domains"),
  skills: z.array(z.string()).min(1).describe("Skill names"),
  industry: z.string().describe("Company industry"),
  company_size: z.string().describe("Company size"),
  country_code: z.string().describe("Location country code"),
  city_name: z.string().describe("Location city name"),
  citizenships: z.array(z.string()),
  birth_year: z.number().min(1950).describe("Birth year"),
});

export type Schedule = z.infer<typeof ScheduleSchema>;
export type Trail = z.infer<typeof TrailSchema>;
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;

// ==========================================
// === NEW SEARCH ARCHITECTURE (4 modes) ===
// ==========================================

export const SearchParamsSchema = z.object({
  strictFields: z
    .array(
      z.enum([
        "position",
        "country_code",
        "domains",
        "skills",
        "industry",
        "company_size",
      ])
    )
    .describe("Fields for selectivity ranking and strict filtering"),
  requiredSkills: z
    .array(z.string())
    .optional()
    .describe("Required skills for matching (used in penalty calculation)"),
  excludedCreationReasons: z
    .array(SharedNewContextReasonSchema)
    .optional()
    .describe("Exclude candidates with these transition reasons"),
  recencyThresholdMonths: z
    .number()
    .min(1)
    .optional()
    .describe("Filter by recency (months since last update)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return"),
});

export const AdHocSearchParamsSchema = SearchParamsSchema.extend({
  adhocContext: SharedUserContextSchema.describe(
    "Context extracted from user query (no registration needed)"
  ),
  targetContext: SharedTargetContextSchema.optional().describe(
    "Optional target context constraints"
  ),
});

export const SavedCurrentSearchParamsSchema = SearchParamsSchema.extend({
  userId: SharedUserIdSchema.describe("User with single context (no trajectory)"),
  targetContext: SharedTargetContextSchema.optional().describe(
    "Optional target context constraints"
  ),
});

export const TrajectorySearchParamsSchema = SearchParamsSchema.extend({
  userId: SharedUserIdSchema.describe(
    "User with trajectory (previous_context_id !== null)"
  ),
  targetContext: SharedTargetContextSchema.optional().describe(
    "Optional target context constraints"
  ),
});

export const TargetOnlySearchParamsSchema = SearchParamsSchema.extend({
  targetContext: SharedTargetContextSchema.describe(
    "Target context to search for (reverse search)"
  ),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;
export type AdHocSearchParams = z.infer<typeof AdHocSearchParamsSchema>;
export type SavedCurrentSearchParams = z.infer<
  typeof SavedCurrentSearchParamsSchema
>;
export type TrajectorySearchParams = z.infer<typeof TrajectorySearchParamsSchema>;
export type TargetOnlySearchParams = z.infer<typeof TargetOnlySearchParamsSchema>;

export const DTWMetricsSchema = z.object({
  shape_similarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Classic DTW similarity (0-1, higher is more similar)"),
  tempo_similarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Derivative DTW similarity - speed of career changes (0-1)"),
  stability_score: z
    .number()
    .min(0)
    .max(1)
    .describe("Path length ratio - career stability (0-1, higher is more stable)"),
});

export type DTWMetrics = z.infer<typeof DTWMetricsSchema>;

export const CandidateWithDTWSchema = z.object({
  user_id: SharedUserIdSchema,
  matched_context: SharedUserContextSchema.describe(
    "Context that matched search criteria"
  ),
  trajectory: z
    .array(SharedUserContextSchema)
    .describe("Full career path from started_working to matched_context"),
  dtw_metrics: DTWMetricsSchema,
  dtw_total: z
    .number()
    .describe("Sum of shape + tempo + stability (0-3)"),
  skills_penalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  total_score: z
    .number()
    .describe("dtw_total + skills_penalty (for sorting)"),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe(
      "Pathfinder = reached goal, Waymate = same goal, null = regular"
    ),
  time_since_matched_months: z
    .number()
    .describe("Months since matched context was created"),
});

export type CandidateWithDTW = z.infer<typeof CandidateWithDTWSchema>;

export const CandidateBasicSchema = z.object({
  user_id: SharedUserIdSchema,
  matched_context: SharedUserContextSchema.describe(
    "Context that matched search criteria"
  ),
  skills_penalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  total_score: z.number().describe("Combined score for ranking"),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe(
      "Pathfinder = reached goal, Waymate = same goal, null = regular"
    ),
  time_since_matched_months: z
    .number()
    .describe("Months since matched context was created"),
});

export type CandidateBasic = z.infer<typeof CandidateBasicSchema>;

export const SkillPenaltySchema = z.object({
  skill: z.string().describe("Skill name"),
  category_name: z.string().nullable().describe("Category this skill belongs to"),
  weight: z
    .number()
    .min(0)
    .max(100)
    .describe("Weight for this skill (from category or default 5.0)"),
  penalty_multiplier: z
    .number()
    .min(0)
    .describe("Penalty multiplier (from category or default 1.0)"),
  penalty_score: z
    .number()
    .describe("Calculated penalty: weight * penalty_multiplier"),
});

export type SkillPenalty = z.infer<typeof SkillPenaltySchema>;

export const SkillsAnalysisSchema = z.object({
  matched_skills: z
    .array(z.string())
    .describe("Skills that match user requirements"),
  extra_skills: z
    .array(z.string())
    .describe("Skills candidate has but user doesn't need"),
  total_penalty: z
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
  candidates: z.array(CandidateBasicSchema),
  total_count: z.number().describe("Total number of candidates found"),
  search_mode: z
    .enum(["ad_hoc", "saved_current"])
    .describe("Which search mode was used"),
});

export type BasicSearchResult = z.infer<typeof BasicSearchResultSchema>;

export const TrajectorySearchResultSchema = z.object({
  candidates: z.array(CandidateWithDTWSchema),
  total_count: z.number().describe("Total number of candidates found"),
  search_mode: z.literal("trajectory").describe("Trajectory search with DTW"),
});

export type TrajectorySearchResult = z.infer<typeof TrajectorySearchResultSchema>;

export const TargetOnlySearchResultSchema = z.object({
  candidates: z.array(CandidateBasicSchema),
  total_count: z.number().describe("Total number of candidates found"),
  search_mode: z.literal("target_only").describe("Reverse search by target"),
});

export type TargetOnlySearchResult = z.infer<typeof TargetOnlySearchResultSchema>;

// ==========================================
// === REASONS (for AI recognition) ===
// ==========================================

export const ReasonSchema = z.object({
  reason_id: z.string().describe("Unique reason identifier"),
  description: z.string().describe("Human-readable description"),
  patterns: z.array(z.string()).describe("Patterns for AI recognition"),
  common_combinations: z
    .array(z.string())
    .describe("Common combinations as comma-separated strings"),
  examples: z.array(z.string()).describe("Example usage"),
});

export type Reason = z.infer<typeof ReasonSchema>;

// ==========================================
// === GOALS ===
// ==========================================

export const GoalWithContextSchema = z.object({
  user_id: SharedUserIdSchema,
  target_context_id: ContextIdSchema,
  created_at: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When goal was created (ISO 8601 format)"),
  target_context: UserContextSchema,
});

export type GoalWithContext = z.infer<typeof GoalWithContextSchema>;

// ==========================================
// === LEGACY SEARCH TYPES (to be removed) ===
// ==========================================

export const SearchContextSchema = UserContextSchema.omit({
  context_id: true,
  created_at: true,
  creation_reason: true,
  previous_context_id: true,
  next_context_id: true,
  birth_year: true,
  citizenships: true,
}).partial();

export const TargetContextSchema = UserContextSchema.partial().and(
  z.object({
    constraints: UserConstraintsSchema.optional(),
  })
);

export const CONTEXT_FIELD_NAMES = [
  "position",
  "domains",
  "skills",
  "industry",
  "country_code",
  "city_name",
  "company_size",
  "birth_year",
] as const satisfies (keyof UserContext)[];

export const ContextFieldSchema = z.enum(CONTEXT_FIELD_NAMES, {
  description: "Available field names for search configuration",
});

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
  max_timing_diff_months: z.number().describe("Relevance within N months"),
  timing_diff_threshold_percent: z
    .number()
    .describe("Percentage threshold for timing filtering"),
  max_experience_diff_months: z
    .number()
    .describe("Maximum experience difference in months"),
  results_limit: z
    .number()
    .min(1)
    .max(20)
    .describe("Results limit for Cypher LIMIT (must be between 1 and 20)"),
  min_experience_months: z
    .number()
    .describe("Minimum work experience")
    .optional(),
  max_experience_months: z
    .number()
    .describe("Maximum work experience")
    .optional(),
  required_skills: z.array(z.string()).describe("Required skills").optional(),
});

export type SearchContext = z.infer<typeof SearchContextSchema>;
export type TargetContext = z.infer<typeof TargetContextSchema>;
export type ContextField = z.infer<typeof ContextFieldSchema>;
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
    .describe("Search period in months (forward lookahead, typically 6/12/18/24)"),
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
    .describe("Search period in months (backward lookback, typically 6/12/18/24)"),
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
  user_id: UserIdSchema,
});

export const DeleteContextParamsSchema = z.object({
  user_id: UserIdSchema,
  context_id: ContextIdSchema,
});

export const DeleteTrailParamsSchema = z.object({
  user_id: UserIdSchema,
  trail_id: TrailIdSchema,
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
  users_count: z
    .number()
    .describe("Total number of users with this combination"),
  stats: z.object({
    avg_duration_months: z
      .number()
      .describe("Average duration to reach future context"),
    median_duration_months: z.number().describe("Median duration in months"),
    target_positions: z
      .array(
        z.object({
          position: z.string(),
          count: z.number(),
        })
      )
      .describe("Array of position frequency objects"),
    common_skills_gained: z
      .array(z.string())
      .describe("Most common skills gained"),
    avg_courses_taken: z
      .number()
      .optional()
      .describe("Average number of courses/trails"),
    avg_investment_usd: z
      .number()
      .optional()
      .describe("Average investment in learning"),
  }),
  sample_users: z
    .array(
      z.object({
        user_id: UserIdSchema,
        match_score: z.number(),
      })
    )
    .describe("Sample users with this combination"),
});

export const CurrentOnlyReasonBasedResultSchema = z.object({
  lookahead_months: z.number().describe("Time period for lookahead"),
  total_candidates: z.number().describe("Total number of candidates found"),
  reason_combinations: z
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

export const StoryInputSchema = z.object({
  user_id: UserIdSchema,
  contexts: z.array(UserContextSchema).min(1),
  trails: z.array(TrailSchema).min(0),
});

export const UpsertContextResultSchema = z.object({
  success: z.boolean(),
  contextIds: z.array(ContextIdSchema),
});

export const UpsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(TrailIdSchema),
});

export const UpsertStoryResultSchema = z.object({
  contexts: UpsertContextResultSchema,
  trails: UpsertTrailResultSchema,
});

export type StoryInput = z.infer<typeof StoryInputSchema>;
export type UpsertContextResult = z.infer<typeof UpsertContextResultSchema>;
export type UpsertTrailResult = z.infer<typeof UpsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof UpsertStoryResultSchema>;

// ==========================================
// === SKILL CATEGORIES ===
// ==========================================

export const SkillCategoryIdSchema = z
  .string()
  .min(1)
  .describe("Skill category ID");

export const SkillCategorySchema = z.object({
  category_id: SkillCategoryIdSchema,
  template_name: z.string().describe("Template this category belongs to"),
  category_name: z.string().describe("Human-readable category name"),
  weight: z.number().min(0).max(100).describe("Weight for positive scoring"),
  penalty_multiplier: z
    .number()
    .min(0)
    .describe("Multiplier for penalty scoring"),
  is_predefined: z
    .boolean()
    .describe("Whether category is from predefined template"),
  created_at: z.string().describe("ISO 8601 datetime"),
});

export const SkillCategoryWithSkillsSchema = SkillCategorySchema.extend({
  skills: z.array(z.string()).describe("Skills assigned to this category"),
});

export const SkillCategoryTemplateSchema = z.object({
  category_name: z.string(),
  weight: z.number().min(0).max(100),
  penalty_multiplier: z.number().min(0),
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
  template_name: z
    .string()
    .describe("Template name (e.g., 'it_software', 'it_data_science')"),
  domain_prefix: z
    .string()
    .optional()
    .describe("Optional prefix for category IDs (e.g., 'company_name')"),
});

export const ListSkillCategoriesParamsSchema = z.object({
  template_name: z.string().optional().describe("Filter by template name"),
});

export const CreateCustomSkillCategoryParamsSchema = z.object({
  category_name: z.string().describe("Human-readable category name"),
  description: z.string().describe("Category description"),
  weight: z.number().min(0).max(100).describe("Weight for positive scoring"),
  penalty_multiplier: z
    .number()
    .min(0)
    .describe("Multiplier for penalty scoring"),
  skills: z.array(z.string()).describe("List of skill names to assign"),
  template_name: z
    .string()
    .optional()
    .describe("Associate with template (optional)"),
});

export const AssignSkillToCategoryParamsSchema = z.object({
  skill_name: z.string().describe("Skill name to assign"),
  category_id: z.string().describe("Target category ID"),
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
