import { z } from "zod";

import { REASON_IDS } from "../../database/reasons.js";

import type { ZodTypeAny } from "zod";

// ==========================================
// === ZOD UTILITIES ===
// ==========================================

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    return unwrapSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema.removeDefault());
  }
  return schema;
}

/**
 * Internal: recursively makes fields nullable (for nested objects)
 */
function makeFieldNullable(schema: ZodTypeAny): z.ZodNullable<ZodTypeAny> {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodObject) {
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod shape is Record<string, ZodTypeAny> at runtime */
    const shape = unwrapped.shape as Record<string, ZodTypeAny>;
    const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

    for (const [key, value] of Object.entries(shape)) {
      newShape[key] = makeFieldNullable(value);
    }

    return z.object(newShape).nullable();
  }

  if (unwrapped instanceof z.ZodArray) {
    return unwrapped.nullable();
  }

  return unwrapped.nullable();
}

/**
 * Transforms a Zod object schema making all fields nullable at all levels.
 * Used for OpenAI Structured Output which requires:
 * - Root type MUST be "object" (not nullable)
 * - All fields MUST be nullable (not optional)
 *
 * Handles: ZodObject (recursive), ZodArray, ZodEnum, primitives
 * Does NOT handle: ZodUnion, ZodIntersection, ZodEffects
 *
 * @example
 * const extractionSchema = makeNullable(userContextSchemaBase);
 * // Root is object, all fields become T | null
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(schema: T): z.ZodObject<z.ZodRawShape> {
  const unwrapped = unwrapSchema(schema);

  if (!(unwrapped instanceof z.ZodObject)) {
    throw new TypeError("makeNullable requires a ZodObject schema at root level");
  }

  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod shape is Record<string, ZodTypeAny> at runtime */
  const shape = unwrapped.shape as Record<string, ZodTypeAny>;
  const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

  for (const [key, value] of Object.entries(shape)) {
    newShape[key] = makeFieldNullable(value);
  }

  return z.object(newShape);
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
export const SESSION_ID_PATTERN = "^sess_[0-9a-f]{32}$";

export const sessionIdSchema = z
  .string()
  .regex(new RegExp(SESSION_ID_PATTERN), "Session ID must be in format sess_<32-char-hex>")
  .describe("Session ID in format sess_<32-char-hex>");

export const tokenSchema = z.string().uuid().describe("User token (UUID v7 format) for authentication");

export type SessionId = z.infer<typeof sessionIdSchema>;
export type Token = z.infer<typeof tokenSchema>;

// User state (for orchestrator routing)
export const userStateSchema = z.object({
  hasContext: z.boolean().describe("User has at least 1 context"),
  hasTrajectory: z.boolean().describe("User has >1 context (linked trajectory)"),
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
]);

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional().describe("Additional error context for debugging"),
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

export const newContextReasonSchema = z.enum(REASON_IDS);

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
  sessionsPerWeek: z.number().describe("Sessions per week").nullable().optional(),
  hoursPerSession: z.number().describe("Hours per session").nullable().optional(),
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
  // Note: .nullable() required for OpenAI Structured Output API compatibility
  totalDurationWeeks: z.number().describe("Total duration in weeks").nullable().optional(),
  schedule: scheduleSchema.nullable().optional(),
  costUsd: z.number().describe("Cost in USD").nullable().optional(),
  ratingCourse: z
    .union([z.number().min(1).max(5), z.null()])
    .optional()
    .describe("Course rating 1-5"),
  ratingPlatform: z
    .union([z.number().min(1).max(5), z.null()])
    .optional()
    .describe("Platform rating 1-5"),
  ratingSchedule: z
    .union([z.number().min(1).max(5), z.null()])
    .optional()
    .describe("Schedule rating 1-5"),

  courseName: z.string().describe("Course name").nullable().optional(),
  courseLink: z.string().describe("Course URL").nullable().optional(),
  userFeedback: z.string().describe("User feedback").nullable().optional(),
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
  previousContextId: contextIdSchema.nullable().optional(),
  nextContextId: contextIdSchema.nullable().optional(),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creationReason: z
    .array(newContextReasonSchema)
    .min(1)
    .describe("Reasons for context creation (always required, use 'started_working' for first job)"),
  position: z.string().min(1).describe("Position title"),
  domains: z.array(z.string()).min(1).describe("Work domains"),
  skills: z.array(z.string()).min(1).describe("Skill names"),
  industry: z.string().describe("Company industry"),
  companySize: z.string().describe("Company size"),
  countryCode: z.string().describe("Location country code"),
  cityName: z.string().describe("Location city name"),
  citizenships: z.array(z.string()),
  birthYear: z.number().min(1950).describe("Birth year"),
  educationLevel: educationLevelSchema.nullable().optional().describe("Education level"),

  // Salary (EITHER exact OR range, mutually exclusive)
  salaryExact: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      "Exact salary in USD. Use if willing to disclose precise amount. Mutually exclusive with salaryMin/salaryMax.",
    ),
  salaryMin: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe("Salary range minimum in USD. For privacy, specify range instead of exact. Use with salaryMax."),
  salaryMax: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe("Salary range maximum in USD. For privacy, specify range instead of exact. Use with salaryMin."),

  // Languages (B2+ proficiency)
  // Semantics: If language in array → B2+ level (fluent for work)
  languages: z
    .array(languageCodeSchema)
    .nullable()
    .optional()
    .describe("Languages with B2+ proficiency (if present → work-ready level)"),

  // User feedback/reflection on this career transition
  feedback: z
    .string()
    .max(200)
    .nullish()
    .describe("Personal reflection on this transition: emotions, insights, lessons learned (max 200 chars)"),
});

export const adhocUserContextSchema = userContextSchemaBase.partial();

export type AdhocUserContext = z.infer<typeof adhocUserContextSchema>;

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
 */
export const targetContextSchema = z.object({
  position: fieldFilterSchema.optional().describe("Target position filter"),
  countries: fieldFilterSchema.optional().describe("Target countries filter"),
  domains: fieldFilterSchema.optional().describe("Target work domains filter"),
  skills: fieldFilterSchema.optional().describe("Target skills filter"),
  languages: fieldFilterSchema.optional().describe("Target languages filter"),
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
  recencyThresholdMonths: z.number().min(1).optional().describe("Filter by recency (months since last update)"),
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
export const userSearchParamsBaseSchema = userSearchParamsRawSchema.transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}));

/**
 * User search parameters (Mode 2: search by user's current context)
 * Flat structure with inverse field filtering logic
 */
export const userSearchParamsSchema = userSearchParamsBaseSchema;

export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;

export const adhocSearchParamsSchema = userSearchParamsRawSchema
  .extend({
    referenceContext: adhocUserContextSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

export type AdhocSearchParams = z.infer<typeof adhocSearchParamsSchema>;

/**
 * Current search parameters (without userId/sessionId) — for Telegram NLP extraction
 * User's context fetched from DB automatically by Core API
 */
export const currentSearchParamsBaseSchema = userSearchParamsRawSchema.omit({ userId: true }).transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}));

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
  recencyThresholdMonths: z.number().min(1).optional().describe("Filter by recency (months since last update)"),
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

// User-extensible dictionaries (excluding reasons - different node schema)
export type SimpleDictionaryType = Exclude<DictionaryType, "reasons">;

// Runtime enum for addTerm + validation
const simpleDictionaryTypes = [
  "skill",
  "position",
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
  complexity: z.number().int().min(0).max(100).nullish(),
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
  hasStory: z.boolean(),
});

export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;

/**
 * Response from link_telegram MCP tool.
 * Links Telegram account to existing LibreChat account.
 */
export const telegramLinkResponseSchema = z.object({
  userId: userIdSchema,
  sessionId: sessionIdSchema,
  hasStory: z.boolean(),
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
 * Multi-phase workflow for goal formation and search.
 */
export const searchGraphResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("checking_goal"), message: z.string() }),
  z.object({
    phase: z.literal("asking_with_goal"),
    message: z.string(),
    goal: goalSchema,
    options: z.array(z.string()),
  }),
  z.object({
    phase: z.literal("asking_no_goal"),
    message: z.string(),
    options: z.array(z.string()),
  }),
  z.object({ phase: z.literal("extracting_goal"), message: z.string() }),
  z.object({
    phase: z.literal("showing_goal"),
    message: z.string(),
    extractedGoal: targetContextSchema,
    options: z.array(z.string()),
  }),
  z.object({
    phase: z.literal("clarifying_goal"),
    message: z.string(),
    extractedGoal: targetContextSchema,
  }),
  z.object({
    phase: z.literal("validating_goal"),
    message: z.string(),
    candidates: z.array(matchedCandidateWithPathSchema),
  }),
  z.object({
    phase: z.literal("asking_after_validate"),
    message: z.string(),
    candidates: z.array(matchedCandidateWithPathSchema),
    options: z.array(z.string()),
  }),
  z.object({
    phase: z.literal("confirming_goal"),
    message: z.string(),
    extractedGoal: targetContextSchema,
  }),
  z.object({ phase: z.literal("setting_goal"), message: z.string() }),
  z.object({ phase: z.literal("searching"), message: z.string() }),
  z.object({
    phase: z.literal("showing_results"),
    message: z.string(),
    results: z.array(scoredMatchedCandidateSchema),
  }),
  z.object({ phase: z.literal("cancelled"), message: z.string() }),
  z.object({ phase: z.literal("failed"), message: z.string() }),
]);

export type SearchGraphResponse = z.infer<typeof searchGraphResponseSchema>;

// ==========================================
// === MCP PARAMS SCHEMAS ===
// ==========================================

/**
 * Params for get_story MCP tool.
 * Returns user's career story (contexts + trails).
 */
export const mcpGetStoryParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type McpGetStoryParams = z.infer<typeof mcpGetStoryParamsSchema>;

/**
 * Params for search_careers MCP tool (adhoc search).
 * Search candidates by reference context (without user story).
 */
export const mcpSearchCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    referenceContext: adhocUserContextSchema,
    sessionId: sessionIdSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

export type McpSearchCareersParams = z.infer<typeof mcpSearchCareersParamsSchema>;

/**
 * Params for search_user_careers MCP tool.
 * Search candidates using authenticated user's story.
 */
export const mcpSearchUserCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    sessionId: sessionIdSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

export type McpSearchUserCareersParams = z.infer<typeof mcpSearchUserCareersParamsSchema>;

/**
 * Params for set_goal MCP tool.
 * Creates or updates user's career goal.
 */
export const mcpSetGoalParamsSchema = z.object({
  targetContext: targetContextSchema,
  sessionId: sessionIdSchema,
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
});

export type McpUpdateContextParams = z.infer<typeof mcpUpdateContextParamsSchema>;

/**
 * Params for get_goal MCP tool.
 * Returns user's goal or null if not set.
 */
export const mcpGetGoalParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type McpGetGoalParams = z.infer<typeof mcpGetGoalParamsSchema>;

/**
 * Params for delete_goal MCP tool.
 * Deletes user's goal.
 */
export const mcpDeleteGoalParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

export type McpDeleteGoalParams = z.infer<typeof mcpDeleteGoalParamsSchema>;

/**
 * Params for search_by_target MCP tool.
 * Search candidates by target context.
 */
export const mcpSearchByTargetParamsSchema = targetSearchParamsBaseSchema.extend({
  sessionId: sessionIdSchema,
});

export type McpSearchByTargetParams = z.infer<typeof mcpSearchByTargetParamsSchema>;

/**
 * Params for delete_context MCP tool.
 * Deletes specific context.
 */
export const mcpDeleteContextParamsSchema = z.object({
  contextId: contextIdSchema,
  sessionId: sessionIdSchema,
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
});

export type McpUpsertContextParams = z.infer<typeof mcpUpsertContextParamsSchema>;

/**
 * Params for converse MCP tool.
 * Single entry point for all user messages — orchestrator determines intent and routes.
 */
export const mcpConverseParamsSchema = z.object({
  message: z.string().min(1).describe("User message in natural language"),
  sessionId: sessionIdSchema,
});

export type McpConverseParams = z.infer<typeof mcpConverseParamsSchema>;

/**
 * Params for cold_start MCP tool.
 * Multi-turn dialog for collecting user's career history.
 */
export const mcpColdStartParamsSchema = z.object({
  message: z.string().min(1).describe("User message (career history or confirmation)"),
  sessionId: sessionIdSchema,
  cvText: z.string().optional().describe("Parsed anonymized text from PDF resume if provided"),
});

export type McpColdStartParams = z.infer<typeof mcpColdStartParamsSchema>;

/**
 * Params for reset_cold_start MCP tool.
 * Resets cold start flow and deletes checkpoint.
 */
export const mcpResetColdStartParamsSchema = z.object({
  sessionId: sessionIdSchema,
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
    .optional()
    .describe("Source context ID if trail originates from a specific context"),
  sessionId: sessionIdSchema,
});

export type McpUpsertTrailParams = z.infer<typeof mcpUpsertTrailParamsSchema>;

/**
 * Params for delete_trail MCP tool.
 * Deletes specific trail.
 */
export const mcpDeleteTrailParamsSchema = z.object({
  trailId: trailIdSchema,
  sessionId: sessionIdSchema,
});

export type McpDeleteTrailParams = z.infer<typeof mcpDeleteTrailParamsSchema>;

/**
 * Params for auth MCP tool.
 * Authenticates user via token.
 */
export const mcpAuthParamsSchema = z.object({
  token: tokenSchema.optional(),
});

export type McpAuthParams = z.infer<typeof mcpAuthParamsSchema>;

/**
 * Params for register_telegram MCP tool.
 * Registers or authenticates user via Telegram (idempotent).
 */
export const mcpTelegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
});

export type McpTelegramRegisterParams = z.infer<typeof mcpTelegramRegisterParamsSchema>;

/**
 * Params for link_telegram MCP tool.
 * Links Telegram account to existing LibreChat account.
 */
export const mcpTelegramLinkParamsSchema = z.object({
  token: tokenSchema.describe("Token from LibreChat account to link"),
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
});

export type McpTelegramLinkParams = z.infer<typeof mcpTelegramLinkParamsSchema>;

/**
 * Params for parse_cv_to_text MCP tool.
 * Parses PDF CV to anonymized markdown text.
 */
export const mcpParseCvToTextParamsSchema = z.object({
  fileBuffer: z.string().describe("Base64-encoded PDF file content"),
  sessionId: sessionIdSchema,
});

export type McpParseCvToTextParams = z.infer<typeof mcpParseCvToTextParamsSchema>;

/**
 * Response from parse_cv_to_text MCP tool
 */
export const parseCvToTextResponseSchema = z.object({
  text: z.string().describe("Parsed anonymized markdown text from CV"),
});

export type ParseCvToTextResponse = z.infer<typeof parseCvToTextResponseSchema>;
