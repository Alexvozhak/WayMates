import { z } from "zod";

import { REASON_CANONICAL_NAMES } from "../../database/reasons.js";

/**
 * Apply pathLimit transform: clamp pathLimit to limit.
 * Used in search params schemas to ensure pathLimit <= limit.
 *
 * @internal Helper for DRY - reduces 5 transform duplications to 1
 */
function withPathLimitTransform<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.transform((data: z.infer<T>) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));
}

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

export const ISO_8601_DATETIME_PATTERN = String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`;

export const UUID_V7_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const USER_ID_PATTERN = `^usr_${UUID_V7_PATTERN}$`;
export const CONTEXT_ID_PATTERN = `^ctx_${UUID_V7_PATTERN}$`;
export const TRAIL_ID_PATTERN = `^trl_${UUID_V7_PATTERN}$`;

export const userIdSchema = z
  .string()
  .regex(new RegExp(USER_ID_PATTERN), "User ID must be in format usr_<UUID>")
  .describe("User ID in format usr_<UUID>");

export const contextIdSchema = z
  .string()
  .regex(new RegExp(CONTEXT_ID_PATTERN), "Context ID must be in format ctx_<UUID>")
  .describe("Context ID in format ctx_<UUID>");

export const trailIdSchema = z
  .string()
  .regex(new RegExp(TRAIL_ID_PATTERN), "Trail ID must be in format trl_<UUID>")
  .describe("Trail ID in format trl_<UUID>");

export type UserId = z.infer<typeof userIdSchema>;
export type ContextId = z.infer<typeof contextIdSchema>;
export type TrailId = z.infer<typeof trailIdSchema>;

// Session and authentication
export const SESSION_ID_PATTERN = "^sess_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export const sessionIdSchema = z
  .string()
  .regex(new RegExp(SESSION_ID_PATTERN), "Session ID must be in format sess_<uuidv7>")
  .describe("Session ID in format sess_<uuidv7>");

export const tokenSchema = z.string().uuid().describe("User token (UUID v7 format) for authentication");

export const requestIdSchema = z.string().uuid().describe("Request correlation ID for distributed tracing");

export type SessionId = z.infer<typeof sessionIdSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type RequestId = z.infer<typeof requestIdSchema>;

// User state (for orchestrator routing)
export const userStateSchema = z.object({
  hasContext: z.boolean().describe("User has at least 1 context"),
  hasGoal: z.boolean().describe("User has a Goal node"),
});

export type UserState = z.infer<typeof userStateSchema>;

// Error handling
export const errorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "unauthorized",
  "invalid_token",
  "normalization_failed",
  "core_api_error",
  "validation_error",
  "internal_error",
  "postgres_connection_failed",
  "postgres_query_failed",
  "document_not_found",
]);

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).nullable().describe("Additional error context for debugging"),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// Result<T, E> discriminated union for MCP tools
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Zod schema for Result error case
export const resultErrorSchema = z.object({
  ok: z.literal(false),
  error: errorResponseSchema,
});

export type ResultError = z.infer<typeof resultErrorSchema>;

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const newContextReasonSchema = z.enum(REASON_CANONICAL_NAMES);

export type NewContextReason = z.infer<typeof newContextReasonSchema>;

export const educationLevelSchema = z.enum([
  "NONE",
  "HIGH_SCHOOL",
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "PROFESSIONAL",
]);

export type EducationLevel = z.infer<typeof educationLevelSchema>;

/**
 * ISO 639-1 language code (2-letter lowercase)
 * Valid codes defined in database/languages.json
 */
export const languageCodeSchema = z
  .string()
  .length(2)
  .regex(/^[a-z]{2}$/, "Language code must be lowercase ISO 639-1 format")
  .describe("ISO 639-1 language code (e.g., 'en', 'de', 'ru')");

export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const scheduleSchema = z.object({
  // Note: .nullable() required for OpenAI Structured Output API compatibility
  sessionsPerWeek: z.number().describe("Sessions per week").nullable(),
  hoursPerSession: z.number().describe("Hours per session").nullable(),
});

/**
 * Base trail schema WITHOUT ID fields.
 * Used by makeNullable() for LLM extraction schemas.
 * IDs (trailId, fromContextId, toContextId) are added by validation node.
 */
export const trailSchemaBase = z.object({
  skill: z.string().min(1).describe("Skill being developed"),
  platform: z.string().min(1).describe("Learning platform used"),

  // OPTIONAL metrics (не всегда известны при extraction)
  // Note: .nullable().default(null) for fixtures compatibility
  totalDurationWeeks: z.number().describe("Total duration in weeks").nullable().default(null),
  schedule: scheduleSchema.nullable().default(null),
  costUsd: z.number().describe("Cost in USD").nullable().default(null),
  ratingCourse: z
    .union([z.number().min(1).max(5), z.null()])
    .default(null)
    .describe("Course rating 1-5"),
  ratingPlatform: z
    .union([z.number().min(1).max(5), z.null()])
    .default(null)
    .describe("Platform rating 1-5"),
  ratingSchedule: z
    .union([z.number().min(1).max(5), z.null()])
    .default(null)
    .describe("Schedule rating 1-5"),

  courseName: z.string().describe("Course name").nullable().default(null),
  courseLink: z.string().describe("Course URL").nullable().default(null),
  userFeedback: z.string().describe("User feedback").nullable().default(null),
});

export const trailSchema = trailSchemaBase.extend({
  trailId: trailIdSchema.describe("Trail ID in format trl_<UUID>"),
  fromContextId: z
    .union([contextIdSchema, z.null().describe("null for trails leading to first context")])
    .describe("Source context ID - string for transition between contexts, null for first context"),
  toContextId: z
    .union([contextIdSchema, z.null().describe("null for ongoing trails")])
    .describe("Target context ID - string for completed, null for ongoing"),
});

// Base schema without refine (for .omit() and .partial() compatibility)
const userContextSchemaBase = z.object({
  contextId: z.string(),
  previousContextId: contextIdSchema.nullable().default(null),
  nextContextId: contextIdSchema.nullable().default(null),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creationReason: z
    .array(newContextReasonSchema)
    .min(1)
    .describe("Reasons for context creation (always required, use 'started_working' for first job)"),
  position: z.string().min(1).describe("Position title (seniority level)"),
  role: z.string().min(1).describe("Profession type: developer, qa, devops, sysadmin, analyst, etc."),
  domains: z.array(z.string()).min(1).describe("Work domains (technical areas)"),
  skills: z.array(z.string()).min(1).describe("Skill names"),
  industry: z.string().describe("Company industry"),
  companySize: z.string().nullable().default(null).describe("Company size (optional for synthetic users)"),
  countryCode: z.string().describe("Location country code"),
  cityName: z.string().describe("Location city name"),
  citizenships: z.array(z.string()).describe("Nationality/passport countries (differs from work location countryCode)"),
  birthYear: z.number().min(1950).nullable().default(null).describe("Birth year (optional for synthetic users)"),
  educationLevel: educationLevelSchema.nullable().default(null).describe("Education level"),

  // Salary (EITHER exact OR range, mutually exclusive)
  salaryExact: z
    .number()
    .min(0)
    .nullable()
    .default(null)
    .describe(
      "Exact salary in USD. Use if willing to disclose precise amount. Mutually exclusive with salaryMin/salaryMax.",
    ),
  salaryMin: z
    .number()
    .min(0)
    .nullable()
    .default(null)
    .describe("Salary range minimum in USD. For privacy, specify range instead of exact. Use with salaryMax."),
  salaryMax: z
    .number()
    .min(0)
    .nullable()
    .default(null)
    .describe("Salary range maximum in USD. For privacy, specify range instead of exact. Use with salaryMin."),

  // Languages (B2+ proficiency)
  // Semantics: If language in array → B2+ level (fluent for work)
  languages: z
    .array(languageCodeSchema)
    .nullable()
    .default(null)
    .describe("Languages with B2+ proficiency (if present → work-ready level)"),

  // User feedback/reflection on this career transition
  feedback: z
    .string()
    .max(200)
    .nullable()
    .default(null)
    .describe("Personal reflection on this transition: emotions, insights, lessons learned (max 200 chars)"),
});

/**
 * Adhoc context base schema for search reference context.
 * Contains subset of userContext fields used for adhoc search.
 *
 * Design (ADR-031):
 * - Uses .pick().partial() for all optional fields (Правило 4)
 * - Runtime type matches normalizer output (partial object with .nullable())
 * - LLM extraction wraps with makeNullable() locally (not exported)
 *
 * Fields:
 * - position, domains, skills, industry, cityName: normalized by Normalizer
 * - countryCode, languages: pass-through (ISO codes don't need normalization)
 *
 * Used by:
 * - adhocSearchParamsSchema (Core API)
 * - Facade MCP tools (search-careers.tool.ts inline)
 * - load-context.ts (LLM extraction via makeNullable wrapper)
 */
export const adhocContextBase = z.object({
  position: z.string().nullable().default(null),
  role: z.string().nullable().default(null),
  domains: z.array(z.string()).nullable().default(null),
  skills: z.array(z.string()).nullable().default(null),
  industry: z.string().nullable().default(null),
  companySize: z.string().nullable().default(null),
  cityName: z.string().nullable().default(null),
  countryCode: z.string().nullable().default(null),
  birthYear: z.number().min(1950).nullable().default(null),
  educationLevel: educationLevelSchema.nullable().default(null),
  languages: z.array(languageCodeSchema).nullable().default(null),
});

export type AdhocContextBase = z.infer<typeof adhocContextBase>;

// Schema with salary validation
export const userContextSchema = userContextSchemaBase.refine(
  (data) => {
    const hasExact = data.salaryExact != null;
    const hasRange = data.salaryMin != null || data.salaryMax != null;

    // Cannot specify both exact and range
    if (hasExact && hasRange) {
      return false;
    }

    // If range specified, min <= max
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMin <= data.salaryMax;
    }

    // If only min OR only max specified - allow (e.g., ">100k" or "<150k")
    return true;
  },
  {
    message: "Specify either exact salary OR salary range (min/max), not both. If range, min must be <= max.",
    path: ["salaryExact"],
  },
);

// Export base for internal use (makeNullable, .omit(), .partial())
export { userContextSchemaBase };

export type Schedule = z.infer<typeof scheduleSchema>;
export type Trail = z.infer<typeof trailSchema>;
export type UserContext = z.infer<typeof userContextSchema>;

// ==========================================
// === TARGET SEARCH FILTER SCHEMAS ===
// ==========================================

/**
 * Filter mode for target search - discriminator for field filters
 */
export const filterModeSchema = z.enum(["desired", "undesired"]);
export type FilterMode = z.infer<typeof filterModeSchema>;

/**
 * Field filter with mode + values (discriminated union pattern)
 * Enforces mutual exclusivity between desired/undesired at type level
 */
export const fieldFilterSchema = z.object({
  mode: filterModeSchema.describe("Filter mode: desired (include) or undesired (exclude)"),
  values: z
    .array(z.string().min(1, "Value cannot be empty").trim())
    .min(1, "At least one value required")
    .max(5, "Maximum 5 values allowed"),
});
export type FieldFilter = z.infer<typeof fieldFilterSchema>;

/**
 * Target context for search criteria
 * Uses FieldFilter discriminated union pattern
 *
 * Business type uses .nullable() for tests and type safety.
 * LLM extraction applies makeNullable() wrapper locally for OpenAI compatibility.
 * See extract-goal.ts, clarify-goal.ts for makeNullable() usage.
 */
export const targetContextSchema = z.object({
  position: fieldFilterSchema.nullable().default(null).describe("Target position filter"),
  role: fieldFilterSchema.nullable().default(null).describe("Target role filter (profession type)"),
  countries: fieldFilterSchema.nullable().default(null).describe("Target countries filter"),
  domains: fieldFilterSchema.nullable().default(null).describe("Target work domains filter"),
  skills: fieldFilterSchema.nullable().default(null).describe("Target skills filter"),
  languages: fieldFilterSchema.nullable().default(null).describe("Target languages filter"),
});

export type TargetContext = z.infer<typeof targetContextSchema>;

// ==========================================
// === SEARCH FILTERS SCHEMAS ===
// ==========================================

/**
 * Available context field names for search configuration
 */
export const contextFieldSchema = z.enum(
  [
    "position",
    "role",
    "domains",
    "skills",
    "industry",
    "countryCode",
    "cityName",
    "companySize",
    "birthYear",
    "educationLevel",
    "languages",
  ],
  {
    description: "Available field names for search configuration",
  },
);

export type ContextField = z.infer<typeof contextFieldSchema>;

// Extract field names from Zod schema to avoid duplication
export const CONTEXT_FIELD_NAMES = contextFieldSchema.options;
/**
 * Raw base schema for user/adhoc search parameters (shared fields)
 * WITHOUT pathLimit validation - for extending in derived schemas (Facade)
 * Exported for Facade to compose its own schemas
 */
export const userSearchParamsRawSchema = z.object({
  userId: userIdSchema.describe("User ID (resolves context from DB)"),
  excludedContextFields: z
    .array(contextFieldSchema)
    .default([])
    .describe(
      "Fields to exclude from comparison (inverse logic: all fields EXCEPT these are strict). " +
        "WARNING: Excluding all fields will match all users - not recommended for production use.",
    )
    .refine((fields) => !fields.includes("skills"), {
      message:
        "Cannot exclude 'skills' - skills scoring (penalties) is required for ranking candidates when no trajectory exists",
    }),
  excludedCreationReasons: z
    .array(newContextReasonSchema)
    .default([])
    .describe("Exclude candidates with these transition reasons (backward path filter in Cypher)"),
  recencyThresholdMonths: z
    .number()
    .min(1)
    .nullable()
    .default(null)
    .describe("Filter by recency (months since last update)"),
  limit: z.number().min(1).max(100).default(20).describe("Maximum number of results to return (pre-filter before DTW)"),
  pathLimit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Final result limit after DTW analysis (ignored if user has no trajectory)"),
});

/**
 * Validated base schema WITH pathLimit auto-clamped to limit
 * Exported for reuse in Facade (replace userId with sessionId)
 */
export const userSearchParamsBaseSchema = withPathLimitTransform(userSearchParamsRawSchema);

/**
 * User search parameters for Core API (Mode 2: search by user's current context).
 * Base schema with userId (domain concern).
 */
export type UserSearchParams = z.infer<typeof userSearchParamsBaseSchema>;

export const adhocSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({
    referenceContext: adhocContextBase,
  }),
);

export type AdhocSearchParams = z.infer<typeof adhocSearchParamsSchema>;

/**
 * Current search parameters (without userId/sessionId) — for Telegram NLP extraction
 * User's context fetched from DB automatically by Core API
 */
export const currentSearchParamsBaseSchema = withPathLimitTransform(userSearchParamsRawSchema.omit({ userId: true }));

export type CurrentSearchParamsBase = z.infer<typeof currentSearchParamsBaseSchema>;

/**
 * Base target search parameters (without userId) — for Telegram and Facade
 * Uses targetContext field name for API compatibility
 * Used by makeNullable() for NLP extraction
 */
export const targetSearchParamsBaseSchema = z.object({
  targetContext: targetContextSchema.describe("Target context criteria (FieldFilter with mode/values)"),
  excludedCreationReasons: z
    .array(newContextReasonSchema)
    .default([])
    .describe("Exclude candidates with these transition reasons (backward path filter)"),
  recencyThresholdMonths: z
    .number()
    .min(1)
    .nullable()
    .default(null)
    .describe("Filter by recency (months since last update)"),
  limit: z.number().min(1).max(100).default(20).describe("Maximum number of results to return"),
});

export type TargetSearchParamsBase = z.infer<typeof targetSearchParamsBaseSchema>;

/**
 * Target search parameters (Mode 4: reverse search by target criteria)
 * Extends base with userId for Core layer
 */
export const targetSearchParamsSchema = targetSearchParamsBaseSchema.extend({
  userId: userIdSchema.describe("User ID to exclude from results (avoid self-match)"),
});

export type TargetSearchParams = z.infer<typeof targetSearchParamsSchema>;

/**
 * Available filters for SearchGraph UI (TargetSearchParams - showing_goal phase)
 * Shows reasons user can exclude during target validation
 * Array of reason IDs (Telegram Bot translates via system prompt)
 */
export const availableFiltersSchema = z.object({
  reasons: z.array(newContextReasonSchema),
});

export type AvailableFilters = z.infer<typeof availableFiltersSchema>;

/**
 * Applied filters feedback (TargetSearchParams - asking_after_validate phase)
 * Shows what filters were applied + rejected reasons (user input not matched)
 * Omits targetContext (already shown in extractedGoal)
 */
export const appliedFiltersSchema = targetSearchParamsBaseSchema.omit({ targetContext: true }).extend({
  rejectedReasons: z.array(z.string()).nullable(),
});

export type AppliedFilters = z.infer<typeof appliedFiltersSchema>;

/**
 * Available filters for SearchGraph UI (CurrentSearchParams - showing_exploration/showing_results)
 * Shows context fields user can exclude during explore/search
 * Array of field IDs (Telegram Bot translates via system prompt)
 */
export const currentAvailableFiltersSchema = z.object({
  contextFields: z.array(contextFieldSchema),
});

export type CurrentAvailableFilters = z.infer<typeof currentAvailableFiltersSchema>;

/**
 * Applied filters feedback (CurrentSearchParams - showing_exploration/showing_results after filter)
 * Shows what filters were applied + rejected fields (user input not matched)
 */
export const currentAppliedFiltersSchema = currentSearchParamsBaseSchema.and(
  z.object({
    rejectedFields: z.array(z.string()).nullable(),
  }),
);

export type CurrentAppliedFilters = z.infer<typeof currentAppliedFiltersSchema>;

// ==========================================
// === STORY & GOAL OPERATIONS ===
// ==========================================

export const storyInputSchema = z
  .object({
    userId: userIdSchema,
    contexts: z.array(userContextSchema).min(1),
    trails: z.array(trailSchema).min(0),
  })
  .superRefine((data, ctx) => {
    if (data.contexts.length === 1) {
      return;
    }

    const contextIds = new Set(data.contexts.map((c) => c.contextId));

    // Rule 1: Exactly one current context (nextContextId = null)
    const currentCount = data.contexts.filter((c) => !c.nextContextId).length;
    if (currentCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contexts"],
        message: `Expected exactly 1 current context (nextContextId=null), found ${currentCount}`,
      });
    }

    // Rule 2: All references must exist (no dangling pointers)
    for (const context of data.contexts) {
      if (context.previousContextId && !contextIds.has(context.previousContextId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contexts"],
          message: `Context ${context.contextId} references non-existent previousContextId: ${context.previousContextId}`,
        });
      }
      if (context.nextContextId && !contextIds.has(context.nextContextId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contexts"],
          message: `Context ${context.contextId} references non-existent nextContextId: ${context.nextContextId}`,
        });
      }
    }
  });

export const upsertContextInputSchema = z.object({
  userId: userIdSchema,
  context: userContextSchema,
});

export const upsertContextResultSchema = z.object({
  success: z.boolean(),
  contextIds: z.array(contextIdSchema),
});

export const upsertSingleContextResultSchema = z.object({
  success: z.boolean(),
  contextId: contextIdSchema,
});

export const upsertTrailInputSchema = z.object({
  userId: userIdSchema,
  trail: trailSchema,
});

export const upsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(trailIdSchema),
});

export const upsertSingleTrailResultSchema = z.object({
  success: z.boolean(),
  trailId: trailIdSchema,
});

export const upsertStoryResultSchema = z.object({
  contexts: upsertContextResultSchema,
  trails: upsertTrailResultSchema,
});

export const deleteStoryResultSchema = z.object({
  success: z.boolean(),
  deletedContexts: z.number(),
  deletedTrails: z.number(),
});

export const operationResultSchema = z.object({
  success: z.boolean(),
});
export type OperationResult = z.infer<typeof operationResultSchema>;

export const goalSchema = z.object({
  userId: userIdSchema,
  targetCriteria: targetContextSchema.describe("Target position criteria with FieldFilter pattern"),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When goal was created (ISO 8601 format)"),
});

export const createGoalInputSchema = z.object({
  userId: userIdSchema,
  targetContext: targetContextSchema.describe("Target search criteria"),
});

export const updateContextInputSchema = userContextSchemaBase
  .omit({
    contextId: true,
    previousContextId: true,
    nextContextId: true,
    createdAt: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// Core API: Structured update (used by tRPC)
export const coreUpdateContextParamsSchema = z.object({
  userId: userIdSchema,
  updates: updateContextInputSchema,
});

export type StoryInput = z.infer<typeof storyInputSchema>;
export type UpsertContextInput = z.infer<typeof upsertContextInputSchema>;
export type UpsertContextResult = z.infer<typeof upsertContextResultSchema>;
export type UpsertSingleContextResult = z.infer<typeof upsertSingleContextResultSchema>;
export type UpsertTrailInput = z.infer<typeof upsertTrailInputSchema>;
export type UpsertTrailResult = z.infer<typeof upsertTrailResultSchema>;
export type UpsertSingleTrailResult = z.infer<typeof upsertSingleTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof upsertStoryResultSchema>;
export type DeleteStoryResult = z.infer<typeof deleteStoryResultSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;
export type UpdateContextInput = z.infer<typeof updateContextInputSchema>;
export type CoreUpdateContextParams = z.infer<typeof coreUpdateContextParamsSchema>;

// ==========================================
// === SEARCH CANDIDATE TYPES (композиция) ===
// ==========================================

// DTW metrics schema
export const dtwMetricsSchema = z.object({
  shapeSimilarity: z.number().min(0).max(1).describe("Path shape similarity (0-1)"),
  tempoSimilarity: z.number().min(0).max(1).describe("Career speed similarity (0-1)"),
  stabilityScore: z.number().min(0).max(1).describe("Job stability metric (0-1)"),
});

export type DTWMetrics = z.infer<typeof dtwMetricsSchema>;

// ==========================================
// === COMPOSITION BLOCKS (defined once) ===
// ==========================================

// Block 1: Core fields
export const candidateCoreSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context that matched search criteria"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context was created"),
});

export type CandidateCore = z.infer<typeof candidateCoreSchema>;

// Block 2: Context scoring fields
export const contextScoringFieldsSchema = z.object({
  contextMatchScore: z.number().min(0).describe("Context match score (raw: matched weights - extra penalties, >= 0)"),
  candidateType: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});

export type ContextScoringFields = z.infer<typeof contextScoringFieldsSchema>;

// Block 3: Path fields (renamed: trajectory → path)
export const pathFieldsSchema = z.object({
  path: z.array(userContextSchema).describe("Full career path from started_working to current_context"),
  trails: z.array(trailSchema).describe("Learning paths between contexts"),
});

export type PathFields = z.infer<typeof pathFieldsSchema>;

// Block 4: DTW fields
export const dtwFieldsSchema = z.object({
  dtwMetrics: dtwMetricsSchema,
  dtwTotal: z.number().min(0).max(3).describe("Sum of shape + tempo + stability (0-3)"),
});

export type DTWFields = z.infer<typeof dtwFieldsSchema>;

// ==========================================
// === FINAL TYPES (composition) ===
// ==========================================

// Type 1: Core only
export const matchedCandidateSchema = candidateCoreSchema;
export type MatchedCandidate = CandidateCore;

// Type 2: Core + Scoring + Optional Path + Optional DTW
// Unified type for both simple context search and DTW search
export const scoredMatchedCandidateSchema = candidateCoreSchema
  .merge(contextScoringFieldsSchema)
  .merge(pathFieldsSchema.partial())
  .merge(dtwFieldsSchema.partial());
export type ScoredMatchedCandidate = z.infer<typeof scoredMatchedCandidateSchema>;

// Type 3: Core + Path
export const matchedCandidateWithPathSchema = candidateCoreSchema.merge(pathFieldsSchema);
export type MatchedCandidateWithPath = z.infer<typeof matchedCandidateWithPathSchema>;

// ==========================================
// === DICTIONARIES ===
// ==========================================

/**
 * Dictionaries containing verified canonical terms
 * Used by LLM for normalization (user input → canonical name)
 * Keys use singular form matching SimpleDictionaryType
 */
export const dictionariesSchema = z.object({
  skill: z.array(z.string()),
  position: z.array(z.string()),
  role: z.array(z.string()),
  domain: z.array(z.string()),
  city: z.array(z.string()),
  industry: z.array(z.string()),
  platform: z.array(z.string()),
  language: z.array(z.string()),
  reasons: z.array(z.string()),
});

export type Dictionaries = z.infer<typeof dictionariesSchema>;

// All dictionary keys (for cache, getVerifiedDictionaries)
export type DictionaryType = keyof Dictionaries;

// User-extensible dictionaries (excluding reasons - predefined, not user-extensible)
export type SimpleDictionaryType = Exclude<DictionaryType, "reasons">;

// Runtime enum for addTerm + validation
const simpleDictionaryTypes = [
  "skill",
  "position",
  "role",
  "domain",
  "city",
  "industry",
  "platform",
  "language",
] as const satisfies readonly SimpleDictionaryType[];

export const simpleDictionaryTypeSchema = z.enum(simpleDictionaryTypes);

export const addTermInputSchema = z.object({
  type: simpleDictionaryTypeSchema,
  canonicalName: z.string().min(1),
  complexity: z.number().int().min(0).max(100).nullable().default(null),
  verified: z.boolean(),
  createdBy: z.string().min(1),
});

export type AddTermInput = z.infer<typeof addTermInputSchema>;

// ==========================================
// === COLD START MCP RESPONSE ===
// ==========================================

/**
 * Base schema for context agenda (what LLM returns during planning).
 * Used by planCareerHistoryTool's structured output.
 */
export const contextAgendaBaseSchema = z.object({
  preview: z.string().describe("Human-readable preview: 'Junior Backend в Яндексе 2020-2022'"),
  incomingTrails: z.array(z.string()).describe("Array of trail preview strings: ['Coursera React course 2022']"),
});

export type ContextAgendaBase = z.infer<typeof contextAgendaBaseSchema>;

/**
 * Queue item with context ID generated upfront (in planning phase).
 * Extends base schema with server-generated contextId.
 */
export const contextAgendaSchema = contextAgendaBaseSchema.extend({
  contextId: contextIdSchema.describe("UUID v7 generated in planning phase"),
});

export type ContextAgenda = z.infer<typeof contextAgendaSchema>;

/**
 * Structured validation error for clarification workflow.
 * Generic helper extracts these from ANY Zod schema.
 */
export const missingFieldSchema = z.object({
  field: z.string().describe("Field name that failed validation"),
  entityLabel: z.string().describe("Human-readable entity label: 'Backend Engineer at Google'"),
  entityType: z.enum(["context", "trail"]).describe("Which entity type this field belongs to"),
  zodMessage: z.string().describe("Zod error message"),
});

export type MissingField = z.infer<typeof missingFieldSchema>;

/**
 * Progress indicator for multi-context collection.
 */
export const collectionProgressSchema = z.object({
  current: z.number().describe("Current context number (1-based for display)"),
  total: z.number().describe("Total contexts in queue"),
});

export type CollectionProgress = z.infer<typeof collectionProgressSchema>;

/**
 * Result of processEntityBatchTool execution - clarification needed.
 */
export const entityBatchResultClarificationSchema = z.object({
  phase: z.literal("awaiting_clarification"),
  message: z.string(),
  missingFields: z.array(missingFieldSchema),
});

/**
 * Result of processEntityBatchTool execution - confirmation needed.
 */
export const entityBatchResultConfirmationSchema = z.object({
  phase: z.literal("awaiting_context_confirmation"),
  message: z.string(),
  entity: userContextSchema,
  relatedTrails: z.array(trailSchema),
  progress: collectionProgressSchema,
});

/**
 * Result of planCareerHistoryTool execution.
 */
export const planResultSchema = z.object({
  phase: z.literal("awaiting_plan_confirmation"),
  message: z.string(),
  queue: z.array(contextAgendaSchema),
});

export type PlanResult = z.infer<typeof planResultSchema>;

/**
 * Final preview result for awaiting_final_confirmation phase.
 */
export const finalPreviewSchema = z.object({
  phase: z.literal("awaiting_final_confirmation"),
  message: z.string(),
  preview: z.object({
    contexts: z.array(userContextSchema),
    trails: z.array(trailSchema),
  }),
  summary: z.object({
    contextsCount: z.number(),
    trailsCount: z.number(),
  }),
});

export type FinalPreview = z.infer<typeof finalPreviewSchema>;

/**
 * Collected story data (contexts + trails + userId).
 * Matches StoryInput structure from shared/schemas.
 */
export const collectedStorySchema = z.object({
  userId: userIdSchema,
  contexts: z.array(userContextSchema),
  trails: z.array(trailSchema),
});

export type CollectedStory = z.infer<typeof collectedStorySchema>;

/**
 * Saved result after successful collection.
 * MCP handler calls Core upsertStory.
 */
export const savedResultSchema = z
  .object({
    phase: z.literal("saved"),
    message: z.string(),
  })
  .merge(collectedStorySchema);

export type SavedResult = z.infer<typeof savedResultSchema>;

/**
 * Already saved result (idempotency protection).
 */
export const alreadySavedResultSchema = z.object({
  phase: z.literal("already_saved"),
  message: z.string(),
});

export type AlreadySavedResult = z.infer<typeof alreadySavedResultSchema>;

/**
 * Cold Start MCP response - discriminated union by phase.
 * This is what cold_start MCP tool returns to telegram-bot.
 */
export const coldStartResponseSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("story_gathering"),
    message: z.string(),
  }),
  planResultSchema,
  entityBatchResultClarificationSchema,
  entityBatchResultConfirmationSchema,
  finalPreviewSchema,
  savedResultSchema,
  alreadySavedResultSchema,
  z.object({
    phase: z.literal("failed"),
    message: z.string(),
  }),
]);

export type ColdStartResponse = z.infer<typeof coldStartResponseSchema>;

// ==========================================
// === MCP RESPONSE SCHEMAS ===
// ==========================================

/**
 * Response from register_telegram MCP tool.
 * Registers or authenticates user via Telegram (idempotent).
 * Token is only returned for new users (isNewUser: true).
 * For existing users, token cannot be recovered from hash storage.
 */
export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema.nullable(),
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
});

export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;

/**
 * Response from link_telegram MCP tool.
 * Links Telegram account to existing LibreChat account.
 */
export const telegramLinkResponseSchema = z.object({
  userId: userIdSchema,
  sessionId: sessionIdSchema,
  token: tokenSchema,
});

export type TelegramLinkResponse = z.infer<typeof telegramLinkResponseSchema>;

/**
 * Response from search_careers and search_user_careers MCP tools.
 * Contains array of matched candidates with scores.
 */
export const searchResultResponseSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number(),
});

export type SearchResultResponse = z.infer<typeof searchResultResponseSchema>;

/**
 * Response from set_goal MCP tool.
 * Returns the created goal ID.
 */
export const setGoalResponseSchema = z.object({
  goalId: z.string(),
});

export type SetGoalResponse = z.infer<typeof setGoalResponseSchema>;

/**
 * Response from delete_* MCP tools (delete_goal, delete_context, delete_trail).
 */
export const deleteSuccessResponseSchema = z.object({
  success: z.literal(true),
});

export type DeleteSuccessResponse = z.infer<typeof deleteSuccessResponseSchema>;

/**
 * Response from reset_cold_start MCP tool.
 */
export const resetColdStartResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type ResetColdStartResponse = z.infer<typeof resetColdStartResponseSchema>;

/**
 * Response from get_story MCP tool.
 * Returns user's career story (contexts + trails).
 */
export const getStoryResponseSchema = z.object({
  contexts: z.array(z.unknown()),
  trails: z.array(z.unknown()),
});

export type GetStoryResponse = z.infer<typeof getStoryResponseSchema>;

/**
 * Response from get_goal MCP tool.
 * Returns user's goal or null if not set.
 */
export const getGoalResponseSchema = z
  .object({
    goalId: z.string(),
    targetContext: z.unknown(),
  })
  .nullable();

export type GetGoalResponse = z.infer<typeof getGoalResponseSchema>;

/**
 * Response from update_context MCP tool.
 * Multi-phase workflow for updating existing context.
 */
export const updateContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("extracting"), message: z.string() }),
  z.object({
    phase: z.literal("awaiting_clarification"),
    message: z.string(),
    missingFields: z.array(missingFieldSchema),
  }),
  z.object({
    phase: z.literal("awaiting_confirmation"),
    message: z.string(),
    before: userContextSchema,
    after: userContextSchema,
  }),
  z.object({ phase: z.literal("saved"), message: z.string(), updatedContext: userContextSchema }),
  z.object({ phase: z.literal("cancelled"), message: z.string() }),
  z.object({ phase: z.literal("failed"), message: z.string() }),
]);

export type UpdateContextResponse = z.infer<typeof updateContextResponseSchema>;

/**
 * Response from upsert_context MCP tool.
 * Multi-phase workflow for creating new context.
 */
export const upsertContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("extracting"), message: z.string() }),
  z.object({
    phase: z.literal("awaiting_clarification"),
    message: z.string(),
    missingFields: z.array(missingFieldSchema),
  }),
  z.object({ phase: z.literal("awaiting_confirmation"), message: z.string(), context: userContextSchema }),
  z.object({ phase: z.literal("saved"), message: z.string(), context: userContextSchema }),
  z.object({ phase: z.literal("cancelled"), message: z.string() }),
  z.object({ phase: z.literal("failed"), message: z.string() }),
]);

export type UpsertContextResponse = z.infer<typeof upsertContextResponseSchema>;

/**
 * Response from upsert_trail MCP tool.
 * Multi-phase workflow for creating new trail.
 */
export const upsertTrailResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("extracting"), message: z.string() }),
  z.object({
    phase: z.literal("awaiting_clarification"),
    message: z.string(),
    missingFields: z.array(missingFieldSchema),
  }),
  z.object({ phase: z.literal("awaiting_confirmation"), message: z.string(), trail: trailSchema }),
  z.object({ phase: z.literal("saved"), message: z.string(), trail: trailSchema }),
  z.object({ phase: z.literal("cancelled"), message: z.string() }),
  z.object({ phase: z.literal("failed"), message: z.string() }),
]);

export type UpsertTrailResponse = z.infer<typeof upsertTrailResponseSchema>;

/**
 * Response from SearchGraph.
 * Multi-phase workflow: explore → goal formation → search.
 */
export const searchGraphResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("checking_goal") }),
  z.object({ phase: z.literal("exploring") }),
  z.object({
    phase: z.literal("showing_exploration"),
    candidates: z.array(scoredMatchedCandidateSchema),
    options: z.array(z.string()),
    currentFilters: currentAvailableFiltersSchema.nullable(),
    appliedCurrentFilters: currentAppliedFiltersSchema.nullable(),
  }),
  z.object({ phase: z.literal("extracting_goal") }),
  z.object({
    phase: z.literal("showing_goal"),
    extractedGoal: targetContextSchema,
    options: z.array(z.string()),
    availableFilters: availableFiltersSchema.nullable(),
  }),
  z.object({
    phase: z.literal("clarifying_goal"),
    extractedGoal: targetContextSchema,
  }),
  z.object({
    phase: z.literal("validating_goal"),
    candidates: z.array(matchedCandidateWithPathSchema),
  }),
  z.object({
    phase: z.literal("asking_after_validate"),
    candidates: z.array(matchedCandidateWithPathSchema),
    options: z.array(z.string()),
    appliedFilters: appliedFiltersSchema.nullable(),
  }),
  z.object({ phase: z.literal("setting_goal") }),
  z.object({ phase: z.literal("deleting_goal") }),
  z.object({ phase: z.literal("searching") }),
  z.object({
    phase: z.literal("showing_results"),
    results: z.array(scoredMatchedCandidateSchema),
    goal: goalSchema.nullable(),
    chartUrl: z.string().url().nullable(),
    options: z.array(z.string()),
    availableFilters: availableFiltersSchema.nullable(),
    currentFilters: currentAvailableFiltersSchema.nullable(),
    appliedCurrentFilters: currentAppliedFiltersSchema.nullable(),
  }),
  z.object({
    phase: z.literal("advising"),
    answerText: z.string(),
    options: z.array(z.string()),
  }),
  z.object({ phase: z.literal("cancelled") }),
  z.object({ phase: z.literal("failed") }),
]);

export type SearchGraphResponse = z.infer<typeof searchGraphResponseSchema>;

/**
 * System message for guards, queries, and error responses.
 * Used when no graph execution is needed (help, validation errors, etc.).
 */
export const systemMessageSchema = z.object({
  phase: z.literal("system_message"),
});

export type SystemMessage = z.infer<typeof systemMessageSchema>;

/**
 * Union of all possible graph responses + system messages.
 * Used for type-safe response handling in orchestrator.
 *
 * Note: Using z.union instead of z.discriminatedUnion because different graphs
 * may share the same phase names (e.g., "awaiting_clarification" in multiple graphs).
 */
export const anyGraphResponseSchema = z.union([
  coldStartResponseSchema,
  upsertContextResponseSchema,
  updateContextResponseSchema,
  upsertTrailResponseSchema,
  searchGraphResponseSchema,
  systemMessageSchema,
]);

export type AnyGraphResponse = z.infer<typeof anyGraphResponseSchema>;

/**
 * Response from converse.tool MCP endpoint.
 * Contains:
 * - result: structured graph data (for UI, buttons, machine processing)
 * - message: full NLP text (ready for display, needs translation only)
 * - activeGraph: graph name for routing
 */
export const converseResponseSchema = z.object({
  result: anyGraphResponseSchema,
  message: z.string(),
  activeGraph: z.string().nullable(),
});

export type ConverseResponse = z.infer<typeof converseResponseSchema>;

// ==========================================
// === MCP PARAMS SCHEMAS ===
// ==========================================

/**
 * Params for get_story MCP tool.
 * Returns user's career story (contexts + trails).
 */
export const mcpGetStoryParamsSchema = z.object({
  targetUserId: userIdSchema.nullable(),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpGetStoryParams = z.infer<typeof mcpGetStoryParamsSchema>;

/**
 * Params for set_goal MCP tool.
 * Creates or updates user's career goal.
 */
export const mcpSetGoalParamsSchema = z.object({
  targetContext: targetContextSchema,
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpSetGoalParams = z.infer<typeof mcpSetGoalParamsSchema>;

/**
 * Params for update_context MCP tool (conversational API).
 * Updates existing context via LangGraph agent (NLP-based).
 */
export const mcpUpdateContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing context updates in natural language. " +
        "Example: 'Добавь React в мои навыки' or 'Измени позицию на Senior Developer'",
    ),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpUpdateContextParams = z.infer<typeof mcpUpdateContextParamsSchema>;

/**
 * Params for get_goal MCP tool.
 * Returns user's goal or null if not set.
 */
export const mcpGetGoalParamsSchema = z.object({
  targetUserId: userIdSchema.nullable(),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpGetGoalParams = z.infer<typeof mcpGetGoalParamsSchema>;

/**
 * Params for delete_goal MCP tool.
 * Deletes user's goal.
 */
export const mcpDeleteGoalParamsSchema = z.object({
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpDeleteGoalParams = z.infer<typeof mcpDeleteGoalParamsSchema>;

/**
 * Params for search_by_target MCP tool.
 * Search candidates by target context.
 */
export const mcpSearchByTargetParamsSchema = targetSearchParamsBaseSchema.extend({
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpSearchByTargetParams = z.infer<typeof mcpSearchByTargetParamsSchema>;

/**
 * Params for delete_context MCP tool.
 * Deletes specific context.
 */
export const mcpDeleteContextParamsSchema = z.object({
  contextId: contextIdSchema,
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpDeleteContextParams = z.infer<typeof mcpDeleteContextParamsSchema>;

/**
 * Params for upsert_context MCP tool (conversational API).
 * Creates new context via LangGraph agent (NLP-based).
 */
export const mcpUpsertContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a new career context in natural language. " +
        "Example: 'Я работаю senior backend в Яндексе с 2023 года в Москве, пишу на Python и Go'",
    ),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpUpsertContextParams = z.infer<typeof mcpUpsertContextParamsSchema>;

/**
 * Params for converse MCP tool.
 * Single entry point for all user messages — orchestrator determines intent and routes.
 */
export const mcpConverseParamsSchema = z.object({
  message: z.string().min(1).describe("User message in natural language"),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpConverseParams = z.infer<typeof mcpConverseParamsSchema>;

/**
 * Params for cold_start MCP tool.
 * Multi-turn dialog for collecting user's career history.
 */
export const mcpColdStartParamsSchema = z.object({
  message: z.string().min(1).describe("User message (career history or confirmation)"),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
  cvText: z.string().nullable().describe("Parsed anonymized text from PDF resume if provided"),
});

export type McpColdStartParams = z.infer<typeof mcpColdStartParamsSchema>;

/**
 * Params for reset_cold_start MCP tool.
 * Resets cold start flow and deletes checkpoint.
 */
export const mcpResetColdStartParamsSchema = z.object({
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpResetColdStartParams = z.infer<typeof mcpResetColdStartParamsSchema>;

/**
 * Params for upsert_trail MCP tool (conversational API).
 * Creates new trail via LangGraph agent (NLP-based).
 */
export const mcpUpsertTrailParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a learning trail in natural language. " +
        "Example: 'I took a React course on Udemy for 8 weeks'",
    ),
  fromContextId: contextIdSchema
    .nullable()
    .nullable()
    .describe("Source context ID if trail originates from a specific context"),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpUpsertTrailParams = z.infer<typeof mcpUpsertTrailParamsSchema>;

/**
 * Params for delete_trail MCP tool.
 * Deletes specific trail.
 */
export const mcpDeleteTrailParamsSchema = z.object({
  trailId: trailIdSchema,
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpDeleteTrailParams = z.infer<typeof mcpDeleteTrailParamsSchema>;

/**
 * Params for auth MCP tool.
 * Authenticates user via token.
 */
export const mcpAuthParamsSchema = z.object({
  token: tokenSchema.nullable(),
  requestId: requestIdSchema,
});

export type McpAuthParams = z.infer<typeof mcpAuthParamsSchema>;

/**
 * Params for register_telegram MCP tool.
 * Registers or authenticates user via Telegram (idempotent).
 */
export const mcpTelegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
  requestId: requestIdSchema,
});

export type McpTelegramRegisterParams = z.infer<typeof mcpTelegramRegisterParamsSchema>;

/**
 * Params for link_telegram MCP tool.
 * Links Telegram account to existing LibreChat account.
 */
export const mcpTelegramLinkParamsSchema = z.object({
  token: tokenSchema.describe("Token from LibreChat account to link"),
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
  requestId: requestIdSchema,
});

export type McpTelegramLinkParams = z.infer<typeof mcpTelegramLinkParamsSchema>;

/**
 * Params for parse_cv_to_text MCP tool.
 * Parses PDF CV to anonymized markdown text.
 */
export const mcpParseCvToTextParamsSchema = z.object({
  fileBuffer: z.string().describe("Base64-encoded PDF file content"),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpParseCvToTextParams = z.infer<typeof mcpParseCvToTextParamsSchema>;

/**
 * Response from parse_cv_to_text MCP tool
 */
export const parseCvToTextResponseSchema = z.object({
  text: z.string().describe("Parsed anonymized markdown text from CV"),
});

export type ParseCvToTextResponse = z.infer<typeof parseCvToTextResponseSchema>;
