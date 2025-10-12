import { z } from "zod";

// === ТИПЫ ===
export type Skill = z.infer<typeof SkillSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type StoryInput = z.infer<typeof StoryInputSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Trail = z.infer<typeof TrailSchema>;
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;
export type TargetContext = z.infer<typeof TargetContextSchema>;
export type NewContextReason = z.infer<typeof NewContextReasonSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type AvatarSearchResult = z.infer<typeof AvatarSearchResultSchema>;
export type AvatarResearchResult = z.infer<typeof AvatarResearchResultSchema>;
export type CurrentToTargetResult = z.infer<typeof CurrentToTargetResultSchema>;
export type TargetAnalysisResult = z.infer<typeof TargetAnalysisResultSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type ContextId = z.infer<typeof ContextIdSchema>;
export type TrailId = z.infer<typeof TrailIdSchema>;
export type UserIdContext = z.infer<typeof UserIdContextSchema>;
export type UserIdTrail = z.infer<typeof UserIdTrailSchema>;
export type ContextField = z.infer<typeof ContextFieldSchema>;
export type FlexibleField = z.infer<typeof FlexibleFieldSchema>;
export type QueryConfig = z.infer<typeof QueryConfigSchema>;

// === БАЗОВЫЕ СХЕМЫ ===
// ISO 8601 дата-время в UTC формате: YYYY-MM-DDTHH:mm:ssZ
// Пример: "2017-09-15T00:00:00Z"
export const ISO_8601_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$";

// Категории навыков (используются в SkillSchema и для строгой фильтрации)
export const SKILL_CATEGORIES = [
  "language",
  "runtime",
  "framework",
  "library",
  "database",
  "cloud",
  "devops",
  "testing",
  "competency",
  "tool",
] as const;

export const SkillCategorySchema = z.enum(SKILL_CATEGORIES, {
  description: "Skill category",
});
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillSchema = z.object({
  name: z.string().describe("Skill name"),
  category: SkillCategorySchema,
});

// TODO DEFAULT_STRICT_SKILL_CATEGORIES нет смысла держать здесь
export const DEFAULT_STRICT_SKILL_CATEGORIES = [
  "language",
  "framework",
  "runtime",
  "database",
] as const satisfies SkillCategory[];

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
    .describe("Reasons for context creation (can be multiple)"),
  position: PositionSchema,
  domains: z.array(z.string()).min(1).describe("Work domains"),
  skills: z.array(SkillSchema).min(1).describe("Skills and competencies"),
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

export const QueryConfigSchema = z.object({
  strictFields: z.array(ContextFieldSchema),
  flexibleFields: z
    .array(FlexibleFieldSchema)
    .refine(
      (fields) => fields.reduce((sum, field) => sum + field.weight, 0) === 100,
      {
        message: "Total weight of flexible fields must equal 100",
      }
    ),
});

// TODO перейти на общую AvatarSearchResultSchema реализацию
export const UserIdContextSchema = z.object({
  user_id: UserIdSchema,
  contexts: z.array(UserContextSchema).min(1),
});

export const AvatarSearchResultSchema = z
  .object({ user_id: UserIdSchema })
  .merge(UserContextSchema);

// Результат анализа прогрессии для CURRENT_ONLY режима
export const AvatarResearchResultSchema = z.object({
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
  trails: z.array(TrailSchema).min(1),
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
  lookAheadMonths: z.number().min(1).max(120),
  reasonsToTrack: z.array(NewContextReasonSchema),
  searchConstraints: SearchConstraintsSchema,
  maxUsers: z.number().optional(),
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

// Опции пресетов для двухстадийного поиска
export const SearchPresetOptionsSchema = z.object({
  currentPreset: z.string(),
  targetPreset: z.string(),
});

// MCP типы для использования в search-modes
export type CurrentToTargetParams = z.infer<typeof CurrentToTargetParamsSchema>;
export type CurrentOnlyParams = z.infer<typeof CurrentOnlyParamsSchema>;
export type TargetOnlyParams = z.infer<typeof TargetOnlyParamsSchema>;
export type TargetSearchParams = z.infer<typeof TargetSearchParamsSchema>;
export type GetUserStoryParams = z.infer<typeof GetUserStoryParamsSchema>;
export type DeleteContextParams = z.infer<typeof DeleteContextParamsSchema>;
export type SearchPresetOptions = z.infer<typeof SearchPresetOptionsSchema>;
export type DeleteTrailParams = z.infer<typeof DeleteTrailParamsSchema>;
export type PingParams = z.infer<typeof PingParamsSchema>;

// === Search Result Schema ===
export const SearchResultSchema = z.object({
  userId: z.string(),
  currentContext: z.nullable(UserContextSchema),
  currentScore: z.nullable(z.number()),
  targetContext: z.nullable(UserContextSchema),
  targetScore: z.nullable(z.number()),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
export const SuccessResultSchema = z.object({ success: z.boolean() });
export type SuccessResult = z.infer<typeof SuccessResultSchema>;
