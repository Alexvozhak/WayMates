import { z } from "zod";
import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "./config.js";

// === ТИПЫ ===
export type UserContext = z.infer<typeof UserContextSchema>;
export type StoryInput = z.infer<typeof StoryInputSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Trail = z.infer<typeof TrailSchema>;
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;
export type TargetContext = z.infer<typeof TargetContextSchema>;
export type NewContextReason = z.infer<typeof NewContextReasonSchema>;
export type Position = z.infer<typeof PositionSchema>;

//TODO разобраться с типами
export type CurrentToTargetParams = z.infer<typeof CurrentToTargetParamsSchema>;

export type TargetOnlyParams = z.infer<typeof TargetOnlyParamsSchema>;
export type TargetSearchParams = z.infer<typeof TargetSearchParamsSchema>;

export type CurrentOnlyResult = z.infer<typeof CurrentOnlyResultSchema>;
export type CurrentOnlyParams = z.infer<typeof CurrentOnlyParamsSchema>;

export type CurrentToTargetResult = z.infer<typeof CurrentToTargetResultSchema>;
export type TargetAnalysisResult = z.infer<typeof TargetAnalysisResultSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type ContextId = z.infer<typeof ContextIdSchema>;
export type TrailId = z.infer<typeof TrailIdSchema>;
export type UserIdContext = z.infer<typeof UserIdContextSchema>;
export type UserIdTrail = z.infer<typeof UserIdTrailSchema>;
export type ContextField = z.infer<typeof ContextFieldSchema>;
export type FlexibleField = z.infer<typeof FlexibleFieldSchema>;
export type QueryConfig =
  | z.infer<typeof CurrentPresetConfigSchema>
  | z.infer<typeof TargetPresetConfigSchema>;
export type UpsertContextResult = z.infer<typeof UpsertContextResultSchema>;
export type UpsertTrailResult = z.infer<typeof UpsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof UpsertStoryResultSchema>;

// MCP типы для использования в search-modes

export type GetUserStoryParams = z.infer<typeof GetUserStoryParamsSchema>;
export type DeleteContextParams = z.infer<typeof DeleteContextParamsSchema>;
export type SearchPresetOptions = z.infer<typeof SearchPresetOptionsSchema>;
export type DeleteTrailParams = z.infer<typeof DeleteTrailParamsSchema>;
export type PingParams = z.infer<typeof PingParamsSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

// Graph-based result types
export type UserGraphNode = z.infer<typeof UserGraphNodeSchema>;
export type UserGraph = z.infer<typeof UserGraphSchema>;
export type CandidateGraphResult = z.infer<typeof CandidateGraphResultSchema>;
export type CurrentProgressionBatch = z.infer<
  typeof CurrentProgressionBatchSchema
>;
export type CurrentProgressionResult = z.infer<
  typeof CurrentProgressionResultSchema
>;
export type TargetReverseBatch = z.infer<typeof TargetReverseBatchSchema>;
export type TargetReverseResult = z.infer<typeof TargetReverseResultSchema>;
export type PipelineGraphResult = z.infer<typeof PipelineGraphResultSchema>;
export type Reason = z.infer<typeof ReasonSchema>;
export type ReasonCombination = z.infer<typeof ReasonCombinationSchema>;
export type CurrentOnlyReasonBasedResult = z.infer<
  typeof CurrentOnlyReasonBasedResultSchema
>;
export type CurrentOnlyReasonParams = z.infer<
  typeof CurrentOnlyReasonParamsSchema
>;
export type SearchContext = z.infer<typeof SearchContextSchema>;

// === БАЗОВЫЕ СХЕМЫ ===
// ISO 8601 дата-время в UTC формате: YYYY-MM-DDTHH:mm:ssZ
// Пример: "2017-09-15T00:00:00Z"
export const ISO_8601_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$";

// ULID regex patterns для валидации и тестирования
export const ULID_PATTERN = "[0-9A-HJKMNP-TV-Z]{26}";
export const USER_ID_PATTERN = `^usr_${ULID_PATTERN}$`;
export const CONTEXT_ID_PATTERN = `^ctx_${ULID_PATTERN}$`;
export const TRAIL_ID_PATTERN = `^trl_${ULID_PATTERN}$`;

export const UserIdSchema = z
  .string()
  .regex(new RegExp(USER_ID_PATTERN), "User ID must be in format usr_ULID")
  .describe("User ID in format usr_ULID");

export const ContextIdSchema = z
  .string()
  .regex(
    new RegExp(CONTEXT_ID_PATTERN),
    "Context ID must be in format ctx_ULID"
  )
  .describe("Context ID in format ctx_ULID");

export const TrailIdSchema = z
  .string()
  .regex(new RegExp(TRAIL_ID_PATTERN), "Trail ID must be in format trl_ULID")
  .describe("Trail ID in format trl_ULID");

// === SKILL CATEGORY SCHEMAS ===
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

export type SkillCategory = z.infer<typeof SkillCategorySchema>;
export type SkillCategoryWithSkills = z.infer<
  typeof SkillCategoryWithSkillsSchema
>;
export type SkillCategoryTemplate = z.infer<typeof SkillCategoryTemplateSchema>;
export type DomainTemplate = z.infer<typeof DomainTemplateSchema>;
export type SkillCategoryTemplatesConfig = z.infer<
  typeof SkillCategoryTemplatesConfigSchema
>;

// Причины создания нового контекста
export const NewContextReasonSchema = z.enum([
  // Основные триггеры развития
  "position_changed",
  "location_changed",
  "company_changed",
  "industry_changed",
  "domain_changed",
  "work_format_changed",
  // Дополнительные причины для creation_reason
  "started_working",
  "stopped_working",
  "skill_learning",
  "goals_change",
  "constraints_update",
  "milestone_achieved",
  "system_recommendation",
  "other",
]);

// TRAILS SCHEMAS
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

export const UserIdTrailSchema = z.object({
  user_id: UserIdSchema,
  trails: z.array(TrailSchema).min(1),
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

// === ЯДРО ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ ===

export const PositionSchema = z.enum([
  "Intern",
  "Junior",
  "Middle",
  "Senior",
  "TeamLead",
  "TechLead",
  "Engineering Manager",
  "Project Manager",
  "Senior Project Manager",
  "Program Manager",
  "Product Manager",
  "Engineering Director",
  "Head of Engineering",
  "VP of Engineering",
  "CTO",
  "CEO",
]);

export const UserContextSchema = z.object({
  context_id: z.string(),
  previous_context_id: ContextIdSchema.optional(),
  next_context_id: ContextIdSchema.optional(),
  created_at: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creation_reason: z
    .array(NewContextReasonSchema)
    .min(1)
    .describe("Reasons for context creation (always required, use 'started_working' for first job)"),
  position: PositionSchema,
  domains: z.array(z.string()).min(1).describe("Work domains"),
  skills: z.array(z.string()).min(1).describe("Skill names"),
  industry: z.string().describe("Company industry"),
  company_size: z.string().describe("Company size"),
  country_code: z.string().describe("Location country code"),
  city_name: z.string().describe("Location city name"),
  work_type: z.enum(["remote", "hybrid", "office"], {
    description: "Work type",
  }),
  citizenships: z.array(z.string()),
  team_size: z.number().min(1).describe("Team size"),
  birth_year: z.number().min(1950).describe("Birth year"),
});

// Search context schema - only relevant fields for matching, all optional
export const SearchContextSchema = UserContextSchema.omit({
  context_id: true,
  created_at: true,
  creation_reason: true,
  previous_context_id: true,
  next_context_id: true,
  birth_year: true,
  citizenships: true,
}).partial();

// === FIELD SNIPPETS SCHEMAS ===
// Поля для конфигурации поиска - извлекаем из UserContextSchema
export const CONTEXT_FIELD_NAMES = [
  "position",
  "domains",
  "skills",
  "industry",
  "country_code",
  "city_name",
  "work_type",
  "company_size",
  "team_size",
  "birth_year",
] as const satisfies (keyof z.infer<typeof UserContextSchema>)[];

export const ContextFieldSchema = z.enum(CONTEXT_FIELD_NAMES, {
  description: "Available field names for search configuration",
});

export const FlexibleFieldSchema = z.object({
  field: ContextFieldSchema,
  weight: z.number().min(0).max(100),
});

// Переиспользуемая схема для flexibleFields с валидацией суммы весов
const FlexibleFieldsSchema = z
  .array(FlexibleFieldSchema)
  .refine(
    (fields) => fields.reduce((sum, field) => sum + field.weight, 0) === 100,
    {
      message: "Total weight of flexible fields must equal 100",
    }
  );

// Current-пресет: обязательные поля в strict
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

// Target-пресет: strictFields может быть пустым
export const TargetPresetConfigSchema = z.object({
  strictFields: z.array(ContextFieldSchema),
  flexibleFields: FlexibleFieldsSchema,
});

// Схемы для коллекций пресетов
export const CurrentPresetsSchema = z.record(CurrentPresetConfigSchema);
export const TargetPresetsSchema = z.record(TargetPresetConfigSchema);

// TODO перейти на общую AvatarSearchResultSchema реализацию
export const UserIdContextSchema = z.object({
  user_id: UserIdSchema,
  contexts: z.array(UserContextSchema).min(1),
});

// export const AvatarSearchResultSchema = z
//   .object({ user_id: UserIdSchema })
//   .merge(UserContextSchema);

// Результат анализа прогрессии для CURRENT_ONLY режима
export const CurrentOnlyResultSchema = z.object({
  userId: UserIdSchema,
  currentLikeContextId: ContextIdSchema,
  compatibilityPercent: z.number(),

  // Контекст через выбранный временной срез
  transitionContextId: ContextIdSchema,

  // Триггеры изменений
  contextTriggers: z.array(NewContextReasonSchema),

  // Метрики по триггерам (опциональные - заполняются если триггер присутствует)

  // POSITION_CHANGED
  monthsInPositionBeforeChange: z.number().optional(),
  ageAtPositionChange: z.number().optional(),

  // LOCATION_CHANGED
  destinationCountry: z.string().optional(),
  destinationCity: z.string().optional(),

  // COMPANY_CHANGED
  companyTypeTransition: z.string().optional(),

  // INDUSTRY_CHANGED
  industryTransition: z.string().optional(),

  // DOMAIN_CHANGED
  techStackTransition: z.string().optional(),

  // WORK_FORMAT_CHANGED
  workFormatTransition: z.string().optional(),
});

// Результат поиска current → target для CURRENT_TO_TARGET режимов
export const CurrentToTargetResultSchema = z.object({
  userId: UserIdSchema,
  currentLikeContextId: ContextIdSchema,
  targetLikeContextId: ContextIdSchema,
  trailPath: z.array(TrailSchema),

  // Timing отклонения
  positionTimingDiffPercent: z.number(),
  positionTimingDiffMonths: z.number(),

  // Skills метрики
  currentSkillsMatched: z.number(),
  currentSkillsTotal: z.number(),
  currentSkillsPercent: z.number(),

  // Experience
  currentExperienceDiffMonths: z.number(),

  // Transition timing
  transitionDurationMonths: z.number(),

  // Geography
  countryMatch: z.boolean(),
  cityMatch: z.boolean(),

  // Company
  companySizeMatch: z.boolean(),
  industryMatch: z.boolean(),
});

// Результат анализа путей достижения цели для TARGET_ONLY режима
export const TargetAnalysisResultSchema = z.object({
  targetPosition: z.string(),
  totalAvatarsFound: z.number(),

  // Пути достижения цели
  achievementPaths: z.array(
    z.object({
      fromPosition: z.string(),
      startingIndustry: z.string(),
      startingCompanySize: z.string(),

      percentageOfAchievers: z.number(),
      averageTransitionMonths: z.number(),
      totalMonthsFromStart: z.number(),
      successRate: z.number(),
      avatarCount: z.number(),

      // Карьерная динамика
      avgPositionChanges: z.number(),
      avgCompanyChanges: z.number(),
      firstPromotionMonths: z.number(),
    })
  ),

  // Временные инвестиции (статистика)
  timingInsights: z.object({
    medianMonths: z.number(),
    percentile25Months: z.number(),
    percentile75Months: z.number(),
    averageAgeAtAchievement: z.number().optional(),
    averageStartingAge: z.number().optional(),
  }),
});

// TODO все вспомогательные схемы перенести в отдельную секцию файла
export const TargetContextSchema = UserContextSchema.partial().and(
  z.object({
    constraints: UserConstraintsSchema.optional(), // TODO вынести из TargetContextSchema
  })
);

export const StoryInputSchema = z.object({
  user_id: UserIdSchema,
  contexts: z.array(UserContextSchema).min(1),
  trails: z.array(TrailSchema).min(0),
});
// .............................
// ...........................
// ...........................
// === ПОИСКОВЫЕ СХЕМЫ ===

// === ДОПОЛНИТЕЛЬНЫЕ СХЕМЫ ДЛЯ MCP SERVER ===

// SearchConstraints schema для MCP server
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

  // Дополнительные фильтры для TARGET_SEARCH режима
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

export type SearchConstraints = z.infer<typeof SearchConstraintsSchema>;

// === MCP SERVER SCHEMAS ===

// MCP параметры для различных режимов поиска
export const CurrentToTargetParamsSchema = z.object({
  currentUserId: UserIdSchema,
  currentPreset: z.string().describe("Preset name for current context search"),
  targetPreset: z.string().describe("Preset name for target context search"),
  currentContext: UserContextSchema,
  targetContext: TargetContextSchema,
  searchConstraints: SearchConstraintsSchema,
});

export const CurrentOnlyParamsSchema = z.object({
  currentUserId: UserIdSchema,
  currentPreset: z.string().describe("Preset name for current context search"),
  currentContext: UserContextSchema,
  stepSizeMonths: z.number().min(1).max(60),
  numberOfSteps: z.number().min(1).max(20),
  includeFinalBatch: z.boolean(),
  searchConstraints: SearchConstraintsSchema,
  reasonsToTrack: z.array(NewContextReasonSchema),
});

export const TargetOnlyParamsSchema = z.object({
  currentUserId: UserIdSchema,
  targetPreset: z.string().describe("Preset name for target context search"),
  targetContext: TargetContextSchema,
  searchConstraints: SearchConstraintsSchema,
});

export const TargetSearchParamsSchema = z.object({
  currentUserId: UserIdSchema,
  targetPreset: z.string().describe("Preset name for target search"),
  targetContext: TargetContextSchema,
  searchConstraints: SearchConstraintsSchema,
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

export const PingParamsSchema = z.object({});

// === SKILL CATEGORY MCP TOOL PARAMS ===
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

// Опции пресетов для двухстадийного поиска
export const SearchPresetOptionsSchema = z.object({
  currentPreset: z.string(),
  targetPreset: z.string(),
});

// === Search Result Schema ===
export const SearchResultSchema = z.object({
  userId: z.string(),
  currentContext: z.nullable(UserContextSchema),
  currentScore: z.nullable(z.number()),
  targetContext: z.nullable(UserContextSchema),
  targetScore: z.nullable(z.number()),
});

// === NEW: Graph-based Result Schemas ===

// Minimal user info for graph
export const UserGraphNodeSchema = z.object({
  user_id: UserIdSchema,
  birth_year: z.number().min(1950).describe("Birth year"),
});

// User graph with minimal info (user + matched context + related context)
export const UserGraphSchema = z.object({
  user: UserGraphNodeSchema,
  matched_context: UserContextSchema.describe(
    "Context that matched the search query"
  ),
  related_context: UserContextSchema.describe(
    "Future context (progression) or previous context (reverse)"
  ),
});

// Candidate result with graph (base for all search modes)
export const CandidateGraphResultSchema = z.object({
  user_id: UserIdSchema,
  match_score: z.number().describe("Compatibility score from Cypher"),
  user_graph: UserGraphSchema,
});

// Current Progression batch (progression forward)
export const CurrentProgressionBatchSchema = z.object({
  period_months: z
    .number()
    .describe("Time period for this batch (6, 12, 18, or 999 for final)"),
  results: z.array(CandidateGraphResultSchema),
});

export const CurrentProgressionResultSchema = z.object({
  batches: z.array(CurrentProgressionBatchSchema),
});

// Target Reverse batch (progression backward)
export const TargetReverseBatchSchema = z.object({
  period_months: z
    .number()
    .describe(
      "Negative time period for this batch (-12, -24, -36, or -999 for earliest)"
    ),
  results: z.array(CandidateGraphResultSchema),
});

export const TargetReverseResultSchema = z.object({
  batches: z.array(TargetReverseBatchSchema),
});

// Pipeline result (current → target)
export const PipelineGraphResultSchema = z.object({
  user_id: UserIdSchema,
  match_score: z.number().describe("Combined compatibility score"),
  user_graph: z.object({
    user: UserGraphNodeSchema,
    matched_current_context: UserContextSchema.describe(
      "Context matching current query"
    ),
    matched_target_context: UserContextSchema.describe(
      "Context matching target query"
    ),
  }),
});

// === REASON-BASED SCHEMAS ===

// Reason schema (for MCP tool list_available_reasons)
export const ReasonSchema = z.object({
  reason_id: z.string().describe("Unique reason identifier"),
  description: z.string().describe("Human-readable description"),
  patterns: z.array(z.string()).describe("Patterns for AI recognition"),
  common_combinations: z
    .array(z.string())
    .describe("Common combinations as comma-separated strings"),
  examples: z.array(z.string()).describe("Example usage"),
});

// Reason combination with user avatars and statistics
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
    .array(CandidateGraphResultSchema)
    .describe("Sample users with this combination (graph-based from БЛОК 2)"),
});

// Result of current-only with reason-based grouping
export const CurrentOnlyReasonBasedResultSchema = z.object({
  lookahead_months: z.number().describe("Time period for lookahead"),
  total_candidates: z.number().describe("Total number of candidates found"),
  reason_combinations: z
    .array(ReasonCombinationSchema)
    .describe("Combinations grouped by creation_reason"),
});

// Current preset names enum
export const CurrentPresetNameSchema = z.enum([
  "BALANCED",
  "SKILL_FOCUSED",
  "GEO_FOCUSED",
  "FLEXIBLE",
  "full",
  "positionOnly",
  "countryOnly",
  "mismatch"
]);

// MCP tool parameters for reason-based current-only search
export const CurrentOnlyReasonParamsSchema = z.object({
  currentPreset: CurrentPresetNameSchema.describe("Preset name for compatibility scoring"),
  currentContext: SearchContextSchema.describe("User's current context (search params, all fields optional)"),
  currentUserId: UserIdSchema.describe("User ID (to exclude from results)"),
  lookahead_months: z
    .number()
    .min(1)
    .max(60)
    .describe("How many months to look ahead (typically 6/12/18/24)"),
  required_reasons: z
    .array(z.string())
    .max(10)
    .optional()
    .describe("Required reasons (must have ALL, max 10)"),
  excluded_reasons: z
    .array(z.string())
    .max(10)
    .optional()
    .describe("Excluded reasons (must have NONE, max 10)"),
});

// Reason-based result types

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
