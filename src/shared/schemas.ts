import { REASON_CANONICAL_NAMES } from "@database/reasons.js";
import ISO6391 from "iso-639-1";
import { z } from "zod";


/**
 * All valid ISO 639-1 language codes for runtime validation.
 */
const VALID_LANGUAGE_CODES = new Set<string>(ISO6391.getAllCodes());

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

/**
 * Single dictionary entry with canonical name and human-readable description.
 * Used in dictionaries API and user-facing UX (e.g., showing filter options).
 */
export const dictionaryEntrySchema = z.object({
  canonicalName: z.string(),
  description: z.string(),
  order: z.number().int().min(1).nullish(),
});

export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>;

// Session and authentication
export const SESSION_ID_PATTERN = "^sess_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export const sessionIdSchema = z
  .string()
  .regex(new RegExp(SESSION_ID_PATTERN), "Session ID must be in format sess_<uuidv7>")
  .describe("Session ID in format sess_<uuidv7>");

export const tokenSchema = z.string().uuid().describe("User token (UUID v7 format) for authentication");

export const requestIdSchema = z.string().uuid().describe("Request correlation ID for distributed tracing");

/**
 * User locale for response language (ISO 639-1 from Telegram).
 * Validates against iso-639-1 codes, defaults to "en".
 */
export const localeSchema = z
  .string()
  .refine((code) => VALID_LANGUAGE_CODES.has(code), { message: "Invalid ISO 639-1 language code" })
  .default("en");

export type SessionId = z.infer<typeof sessionIdSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type Locale = z.infer<typeof localeSchema>;

// User state (for orchestrator routing)
export const userStateSchema = z.object({
  hasContext: z.boolean().describe("User has at least 1 context"),
  hasGoal: z.boolean().describe("User has a Goal node"),
});

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

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const newContextReasonSchema = z.enum(REASON_CANONICAL_NAMES);

/**
 * Education level (dictionary-based, like position/industry)
 * Values loaded from EducationLevel nodes in Neo4j
 */
export const educationLevelSchema = z.string().describe("Education level canonical name");

/**
 * ISO 639-1 language code (2-letter uppercase)
 * Valid codes defined in database/languages.json
 */
export const languageCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Language code must be uppercase ISO 639-1 format")
  .describe("ISO 639-1 language code");

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
  industry: z.string().min(1).describe("Company industry"),
  companySize: z.string().nullable().default(null).describe("Company size (optional for synthetic users)"),
  countryCode: z.string().min(1).describe("ISO 3166-1 alpha-2 country code"),
  cityName: z.string().min(1).describe("Location city name"),
  citizenships: z.array(z.string().min(1)).min(1).describe("ISO 3166-1 alpha-2 country codes"),
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
  citizenships: z.array(z.string()).nullable().default(null),
  birthYear: z.number().min(1950).nullable().default(null),
  educationLevel: educationLevelSchema.nullable().default(null),
  languages: z.array(languageCodeSchema).nullable().default(null),
  salaryMin: z.number().nullable().default(null).describe("Minimum current salary (annual, USD)"),
  salaryMax: z.number().nullable().default(null).describe("Maximum current salary (annual, USD)"),
});

export type AdhocContextBase = z.infer<typeof adhocContextBase>;

/**
 * Strict schema for adhoc context validation.
 * Inherits optional fields from base, overrides required fields to be non-nullable.
 * Used with safeParse to get missing fields list.
 */
export const adhocContextRequiredSchema = adhocContextBase
  .omit({ position: true, role: true, countryCode: true, domains: true })
  .extend({
    position: z.string().min(1).describe("Level (junior/middle/senior)"),
    role: z.string().min(1).describe("Specialty (backend/frontend/etc)"),
    countryCode: z.string().min(1).describe("ISO 3166-1 alpha-2 country code"),
    domains: z.array(z.string()).min(1).describe("Work area (at least 1)"),
  });

export type AdhocContextRequired = z.infer<typeof adhocContextRequiredSchema>;

/** Required field names for UI */
export const ADHOC_REQUIRED_FIELDS = [
  "position",
  "role",
  "countryCode",
  "domains",
] as const satisfies readonly (keyof AdhocContextRequired)[];
export type AdhocRequiredField = (typeof ADHOC_REQUIRED_FIELDS)[number];

/** Optional field names for UI */
export const ADHOC_OPTIONAL_FIELDS = [
  "skills",
  "industry",
  "companySize",
  "cityName",
  "citizenships",
  "birthYear",
  "educationLevel",
  "languages",
  "salaryMin",
  "salaryMax",
] as const satisfies readonly (keyof AdhocContextBase)[];

export type AdhocOptionalField = (typeof ADHOC_OPTIONAL_FIELDS)[number];

/** Zod schema for optional field names */
export const adhocOptionalFieldSchema = z.enum(ADHOC_OPTIONAL_FIELDS);

/** Optional fields for Goal (not required for meaningful search) */
export const GOAL_OPTIONAL_FIELDS = [
  "domains",
  "skills",
  "languages",
  "industries",
  "cities",
  "citizenships",
  "educationLevels",
  "salaryMin",
  "salaryMax",
] as const;

export type GoalOptionalField = (typeof GOAL_OPTIONAL_FIELDS)[number];

/** Zod schema for goal optional field names */
export const goalOptionalFieldSchema = z.enum(GOAL_OPTIONAL_FIELDS);

/** System/platform fields not shown to user in cold-start clarification (linked to UserContext) */
type ContextSystemField = keyof Pick<
  UserContext,
  "contextId" | "previousContextId" | "nextContextId" | "createdAt" | "creationReason"
>;

/** Runtime array of system field names (type-checked) — never show to user */
export const CONTEXT_SYSTEM_FIELDS = [
  "contextId",
  "previousContextId",
  "nextContextId",
  "createdAt",
  "creationReason",
] as const satisfies readonly ContextSystemField[];

/** Required fields that USER must provide in cold-start (linked to UserContext) */
type ContextRequiredField = keyof Pick<
  UserContext,
  "position" | "role" | "domains" | "skills" | "industry" | "countryCode" | "cityName" | "citizenships"
>;

/** Required fields for Trail */
type TrailRequiredField = keyof Pick<Trail, "skill" | "platform">;

/** Runtime array of required field names for cold-start (type-checked) */
export const CONTEXT_REQUIRED_FIELDS = [
  "position",
  "role",
  "domains",
  "skills",
  "industry",
  "countryCode",
  "cityName",
  "citizenships",
] as const satisfies readonly ContextRequiredField[];

/** Runtime array of required trail field names (type-checked) */
export const TRAIL_REQUIRED_FIELDS = ["skill", "platform"] as const satisfies readonly TrailRequiredField[];

/** Optional fields derived from UserContext (nullable fields, excluding system) */
export type ContextOptionalField = Exclude<keyof UserContext, ContextRequiredField | ContextSystemField>;

/** Runtime array of optional field names for cold-start UI */
export const CONTEXT_OPTIONAL_FIELDS = [
  "companySize",
  "birthYear",
  "educationLevel",
  "salaryExact",
  "salaryMin",
  "salaryMax",
  "languages",
  "feedback",
] as const satisfies readonly ContextOptionalField[];

/** Missing field info for adhoc context validation */
export const adhocMissingFieldSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type AdhocMissingField = z.infer<typeof adhocMissingFieldSchema>;

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

export type Trail = z.infer<typeof trailSchema>;
export type UserContext = z.infer<typeof userContextSchema>;

// ==========================================
// === TARGET SEARCH FILTER SCHEMAS ===
// ==========================================

/**
 * Filter mode for target search - discriminator for field filters
 */
export const filterModeSchema = z.enum(["desired", "undesired"]);
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
  industries: fieldFilterSchema.nullable().default(null).describe("Target industry filter (business sector)"),
  cities: fieldFilterSchema.nullable().default(null).describe("Target city filter (for relocation)"),
  citizenships: fieldFilterSchema
    .nullable()
    .default(null)
    .describe("Required citizenships filter (passport countries)"),
  educationLevels: fieldFilterSchema.nullable().default(null).describe("Required education level filter"),
  salaryMin: z.number().nullable().default(null).describe("Minimum desired salary (annual, USD)"),
  salaryMax: z.number().nullable().default(null).describe("Maximum desired salary (annual, USD)"),
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
    "citizenships",
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
 * Waymates search parameters (unified adhoc + byUser).
 * - referenceContext present = adhoc mode (use provided context)
 * - referenceContext absent = profile mode (resolve from DB)
 */
export const waymatesSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({
    referenceContext: adhocContextBase.optional(),
    waymatesOnly: z
      .boolean()
      .default(false)
      .describe("Filter to only return candidates with isWaymate=true (same goal) BEFORE applying pathLimit"),
  }),
);

export type WaymatesSearchParams = z.infer<typeof waymatesSearchParamsSchema>;

/**
 * Current search parameters (without userId/sessionId) — for Telegram NLP extraction
 * User's context fetched from DB automatically by Core API
 */
export const currentSearchParamsBaseSchema = withPathLimitTransform(userSearchParamsRawSchema.omit({ userId: true }));

/**
 * Nullable schema for target search — OpenAI structured output compatibility.
 * All optional fields are nullable (not optional) per OpenAI requirements.
 * Used by: LLM extraction in facade, makeNullable() wrappers.
 */
export const targetSearchParamsNullableSchema = z.object({
  targetContext: targetContextSchema.describe("Target context criteria (FieldFilter with mode/values)"),
  excludedCreationReasons: z
    .array(newContextReasonSchema)
    .nullable()
    .describe("Exclude candidates with these transition reasons (backward path filter)"),
  recencyThresholdMonths: z.number().min(1).nullable().describe("Filter by recency (months since last update)"),
  limit: z.number().min(1).max(100).nullable().describe("Maximum number of results to return"),
});

/**
 * Nullable schema for target context search filters (partial modification).
 * Used in parse-intent for "validate" intent — user applies filters to target search.
 * Note: Does NOT include targetContext (that's in targetSearchParamsNullableSchema).
 */
export const targetContextSearchFilterNullableSchema = z.object({
  excludedCreationReasons: z.array(newContextReasonSchema).nullable(),
  recencyThresholdMonths: z.number().nullable(),
  limit: z.number().nullable(),
});

/**
 * Nullable schema for current context search filters (partial modification).
 * Used in parse-intent for "filter" intent — user modifies current search params.
 *
 * NOTE: 'skills' cannot be excluded — Core API requires skills for ranking
 * when no userTrajectory exists. See: core/routers/search/waymates.ts
 */
export const currentContextSearchFilterNullableSchema = z.object({
  excludedContextFields: z
    .array(contextFieldSchema)
    .nullable()
    .describe("Fields to exclude from matching. NEVER include 'skills' — required for ranking."),
  excludedCreationReasons: z.array(newContextReasonSchema).nullable(),
  recencyThresholdMonths: z.number().nullable(),
  limit: z.number().nullable(),
  pathLimit: z.number().nullable(),
});

/**
 * Base target search parameters WITH defaults (business logic layer).
 * .extend() перезаписывает типы nullable → with defaults.
 * Used by:
 * - MCP tools (extend with sessionId)
 * - Core API (extend with userId)
 */
export const targetSearchParamsBaseSchema = targetSearchParamsNullableSchema.extend({
  excludedCreationReasons: z.array(newContextReasonSchema).default([]),
  recencyThresholdMonths: z.number().min(1).nullable().default(null),
  limit: z.number().min(1).max(100).default(20),
});

/**
 * Target search parameters (Mode 4: reverse search by target criteria)
 * Extends base with userId for Core API layer.
 */
export const targetSearchParamsSchema = targetSearchParamsBaseSchema.extend({
  userId: userIdSchema.describe("User ID to exclude from results (avoid self-match)"),
});

export type TargetSearchParams = z.infer<typeof targetSearchParamsSchema>;

/**
 * Pathfinder search parameters (Mode 3: proof of transition).
 * Finds people who went FROM our context TO our goal.
 *
 * Dual matching:
 * - referenceContext: their history contains context similar to ours
 * - targetContext: their history contains our goal
 *
 * Dual recency:
 * - referenceRecencyMonths: how long ago they were in our context (~2-5 years = path length)
 * - targetRecencyMonths: how recently they reached the goal (~2-6 months)
 */
export const pathfinderSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.omit({ recencyThresholdMonths: true }).extend({
    referenceContext: adhocContextBase.describe("Our current context for matching"),
    targetContext: targetContextSchema.describe("Our goal for matching"),
    userTrajectory: z
      .array(userContextSchema)
      .optional()
      .describe("User trajectory for DTW calculation (profile mode)"),
    referenceRecencyMonths: z
      .number()
      .min(1)
      .nullable()
      .default(null)
      .describe("Max months since being in reference context (path length)"),
    targetRecencyMonths: z.number().min(1).nullable().default(null).describe("Max months since reaching target"),
  }),
);

export type PathfinderSearchParams = z.infer<typeof pathfinderSearchParamsSchema>;

/**
 * Applied filters feedback (TargetSearchParams - asking_after_validate phase)
 * Shows what filters were applied + rejected reasons (user input not matched)
 * Omits targetContext (already shown in extractedGoal)
 */
export const targetAppliedFiltersSchema = targetSearchParamsBaseSchema.omit({ targetContext: true }).extend({
  rejectedReasons: z.array(z.string()).nullable(),
});

/**
 * Applied filters feedback (CurrentSearchParams - showing_exploration/showing_results after filter)
 * Shows what filters were applied + rejected fields (user input not matched)
 */
export const currentAppliedFiltersSchema = currentSearchParamsBaseSchema.and(
  z.object({
    rejectedFields: z.array(z.string()).nullable(),
  }),
);

// ==========================================
// === STORY & GOAL OPERATIONS ===
// ==========================================

export const storyInputSchema = z
  .object({
    userId: userIdSchema,
    contexts: z.array(userContextSchema).min(0),
    trails: z.array(trailSchema).min(0),
  })
  .superRefine((data, ctx) => {
    const MIN_CONTEXTS_FOR_CHAIN = 2;
    if (data.contexts.length < MIN_CONTEXTS_FOR_CHAIN) {
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

export const upsertTrailInputSchema = z.object({
  userId: userIdSchema,
  trail: trailSchema,
});

export const upsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(trailIdSchema),
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

export const goalSchema = z.object({
  userId: userIdSchema,
  targetContext: targetContextSchema.describe("Target position criteria with FieldFilter pattern"),
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
export type UpsertTrailInput = z.infer<typeof upsertTrailInputSchema>;
export type UpsertTrailResult = z.infer<typeof upsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof upsertStoryResultSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;
export type CoreUpdateContextParams = z.infer<typeof coreUpdateContextParamsSchema>;

// ==========================================
// === SEARCH CANDIDATE TYPES (композиция) ===
// ==========================================

// DTW metrics schema
export const dtwMetricsSchema = z.object({
  shapeSimilarity: z.number().min(0).max(1).describe("Path shape similarity (0-1)"),
  tempoSimilarity: z.number().min(0).max(1).describe("Career speed similarity (0-1)"),
  alignmentScore: z.number().min(0).max(1).describe("DTW path alignment quality (0-1)"),
});

export type DTWMetrics = z.infer<typeof dtwMetricsSchema>;

// ==========================================
// === CANDIDATE BASE (unified) ===
// ==========================================

// Base schema for all candidate types (full, after enrichment with path/trails)
// matchedContext = context that matched OUR CURRENT context (where candidate was like us)
// path/trails required - added by PathCollectorService after Cypher query
export const candidateBaseSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context that matched our current context"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context was created"),
  contextMatchScore: z.number().min(0).describe("Context match score (raw: matched weights - extra penalties, >= 0)"),
  path: z.array(userContextSchema).describe("Full career path from started_working to current_context"),
  trails: z.array(trailSchema).describe("Learning paths between contexts"),
  dtwMetrics: dtwMetricsSchema.optional().describe("DTW metrics (when userTrajectory provided)"),
  dtwTotal: z.number().min(0).max(3).optional().describe("Sum of DTW metrics (0-3)"),
});

export type CandidateBase = z.infer<typeof candidateBaseSchema>;

// ==========================================
// === FINAL TYPES (composition) ===
// ==========================================

// Type 1a: Waymate candidate Light (from Cypher, without path/trails)
// Used for parsing buildWaymatesSearchQuery result before PathCollectorService enrichment
export const waymateCandidateLightSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context that matched our current context"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context"),
  contextMatchScore: z.number().min(0).describe("Context match score"),
  isWaymate: z.boolean().describe("True if candidate has same goal as searching user"),
});
export type WaymateCandidateLight = z.infer<typeof waymateCandidateLightSchema>;

// Type 1b: Waymate candidate (full, with path/trails after enrichment)
export const waymateCandidateSchema = candidateBaseSchema.extend({
  isWaymate: z.boolean().describe("True if candidate has same goal as searching user"),
});
export type WaymateCandidate = z.infer<typeof waymateCandidateSchema>;

// Type 2a: Pathfinder candidate Light (from Cypher, without path/trails)
// Used for parsing buildPathfinderSearchQuery result
export const pathfinderCandidateLightSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context where they were like us"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context"),
  contextMatchScore: z.number().min(0).describe("Context match score"),
  targetContext: userContextSchema.describe("Context where they reached our goal"),
  timeSinceTargetMonths: z.number().min(0).describe("Months since reaching target"),
});
// Type 2b: Pathfinder candidate (full, with path/trails from base)
// Used by searchPathfinders - finds people who went FROM our context TO our goal
// matchedContext (from base) = where they were like us
// targetContext = where they reached our goal
export const pathfinderCandidateSchema = candidateBaseSchema.extend({
  targetContext: userContextSchema.describe("Context that matched our goal (where they arrived)"),
  timeSinceTargetMonths: z.number().min(0).describe("Months since reaching target context"),
});
export type PathfinderCandidate = z.infer<typeof pathfinderCandidateSchema>;

// Type 3: Core + Path (for reverseSearchPathfinders)
// Uses legacy field name for backward compatibility with existing Cypher queries
export const matchedCandidateWithPathSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context that matched search criteria"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context was created"),
  path: z.array(userContextSchema).describe("Full career path"),
  trails: z.array(trailSchema).describe("Learning paths between contexts"),
});
export type MatchedCandidateWithPath = z.infer<typeof matchedCandidateWithPathSchema>;

// ==========================================
// === FACETS (for large result sets) ===
// ==========================================

export type FacetField = keyof Pick<UserContext, "countryCode" | "position" | "role" | "industry">;

export const facetValueSchema = z.object({
  value: z.string(),
  count: z.number(),
});
export type FacetValue = z.infer<typeof facetValueSchema>;

export const candidateFacetsSchema = z.object({
  totalCount: z.number(),
  countries: z.array(facetValueSchema),
  positions: z.array(facetValueSchema),
  roles: z.array(facetValueSchema),
  industries: z.array(facetValueSchema),
  citizenships: z.array(facetValueSchema),
});
export type CandidateFacets = z.infer<typeof candidateFacetsSchema>;

// ==========================================
// === DICTIONARIES ===
// ==========================================

/**
 * Dictionaries containing verified canonical terms with descriptions.
 * Used by LLM for normalization (user input → canonical name).
 * Keys use singular form matching SimpleDictionaryType.
 */
export const dictionariesSchema = z.object({
  skill: z.array(dictionaryEntrySchema),
  position: z.array(dictionaryEntrySchema),
  role: z.array(dictionaryEntrySchema),
  domain: z.array(dictionaryEntrySchema),
  city: z.array(dictionaryEntrySchema),
  industry: z.array(dictionaryEntrySchema),
  platform: z.array(dictionaryEntrySchema),
  language: z.array(dictionaryEntrySchema),
  education_level: z.array(dictionaryEntrySchema),
  reasons: z.array(dictionaryEntrySchema),
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
  "education_level",
] as const satisfies readonly SimpleDictionaryType[];

export const simpleDictionaryTypeSchema = z.enum(simpleDictionaryTypes);

// === CLOSED vs OPEN dictionaries ===
// Closed: fixed set, user cannot add new values (must select from suggestions)
// Open: user can add new values (skills, cities, etc.)
const closedDictionaryTypes = ["role", "position"] as const satisfies readonly SimpleDictionaryType[];
export type ClosedDictionaryType = (typeof closedDictionaryTypes)[number];
const closedDictionarySet = new Set<string>(closedDictionaryTypes);
export const isClosedDictionary = (type: SimpleDictionaryType): type is ClosedDictionaryType =>
  closedDictionarySet.has(type);

export const rolePositionSuggestionSchema = z.object({
  field: z.enum(["role", "position"]).describe("Which closed dictionary field needs selection"),
  original: z.string().describe("User's original input that didn't match dictionary"),
  suggestions: z.array(z.string()).describe("Up to 3 closest matches from dictionary"),
});

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

/** Describe strings for LLM structured output (generated from type-checked arrays) */
const TRAIL_FIELDS_DESC = TRAIL_REQUIRED_FIELDS.join(", ");

/**
 * Base schema for context agenda (what LLM returns during planning).
 * Used by planCareerHistoryTool's structured output.
 */
export const contextAgendaBaseSchema = z.object({
  startYear: z.number().describe("Year position started (e.g., 2016)"),
  endYear: z.number().nullable().describe("Year position ended (e.g., 2023), or null if current"),
  title: z
    .string()
    .describe(
      "Job title ONLY. Examples: 'Software Engineer', 'Team Lead', 'CTO'. NEVER include skills, technologies or details in parentheses like '(C++/Python)' - those go in separate fields",
    ),
  incomingTrails: z.array(z.string()).describe(`Trail info: ${TRAIL_FIELDS_DESC} — only if explicitly mentioned`),
});

export type ContextAgendaBase = z.infer<typeof contextAgendaBaseSchema>;

/**
 * Queue item with context ID generated upfront (in planning phase).
 * Extends base schema with server-generated contextId.
 */
export const contextAgendaSchema = contextAgendaBaseSchema.extend({
  contextId: contextIdSchema.describe("UUID v7 generated in planning phase"),
  preview: z.string().describe("Formatted preview: 'YYYY-YYYY: Job Title' (generated from startYear, endYear, title)"),
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

/** Zod schema for context optional field names */
export const contextOptionalFieldSchema = z.enum(CONTEXT_OPTIONAL_FIELDS);

/**
 * Result of processEntityBatchTool execution - clarification needed.
 * Structured like search-graph adhoc: FILLED (pendingContext) + MISSING + OPTIONAL
 */
export const entityBatchResultClarificationSchema = z.object({
  phase: z.literal("awaiting_clarification"),
  message: z.string(),
  entityPreview: z.string().describe("Current context being processed"),
  progress: collectionProgressSchema.describe("Position in queue"),
  pendingContext: z.record(z.unknown()).describe("Current extracted values (FILLED fields)"),
  missingFields: z.array(missingFieldSchema).describe("Required fields still missing (MISSING)"),
  optionalFields: z.array(contextOptionalFieldSchema).describe("Optional fields user can add (OPTIONAL)"),
  suggestCancel: z.boolean().optional().describe("True when user repeatedly fails to provide required fields"),
  rolePositionSuggestions: z.array(rolePositionSuggestionSchema).optional().describe("Suggestions for role/position"),
});

/**
 * Result of processEntityBatchTool execution - confirmation needed.
 * Includes normalizations array showing what STRICT fields were normalized.
 */
export const entityBatchResultConfirmationSchema = z.object({
  phase: z.literal("awaiting_context_confirmation"),
  message: z.string(),
  entity: userContextSchema,
  relatedTrails: z.array(trailSchema),
  progress: collectionProgressSchema,
  periodStart: z.number().describe("Year position started (from planning phase)"),
  periodEnd: z.number().nullable().describe("Year position ended, or null if current"),
  normalizations: z
    .array(
      z.object({
        field: simpleDictionaryTypeSchema.extract(["position", "role", "domain", "industry"]),
        original: z.string(),
        normalized: z.string(),
      }),
    )
    .describe("STRICT fields that were normalized (position/role/domain/industry)"),
});

/**
 * Result of planCareerHistoryTool execution.
 */
export const planResultSchema = z.object({
  phase: z.literal("awaiting_plan_confirmation"),
  message: z.string(),
  queue: z.array(contextAgendaSchema),
});

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

/**
 * Collected story data (contexts + trails + userId).
 * Matches StoryInput structure from shared/schemas.
 */
export const collectedStorySchema = z.object({
  userId: userIdSchema,
  contexts: z.array(userContextSchema),
  trails: z.array(trailSchema),
});

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

/**
 * Already saved result (idempotency protection).
 */
export const alreadySavedResultSchema = z.object({
  phase: z.literal("already_saved"),
  message: z.string(),
});

/**
 * Cold Start MCP response - discriminated union by phase.
 * This is what cold_start MCP tool returns to telegram-bot.
 */
const storyMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export const coldStartResponseSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("story_gathering"),
    messages: z.array(storyMessageSchema),
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
  z.object({
    phase: z.literal("asking_adhoc_context"),
    adhocContext: adhocContextBase.nullable(),
    missingFields: z.array(adhocMissingFieldSchema),
    optionalFields: z.array(adhocOptionalFieldSchema),
  }),
  z.object({
    phase: z.literal("confirming_adhoc_context"),
    adhocContext: adhocContextBase.nullable(),
    goal: goalSchema.nullable(),
    missingFields: z.array(adhocMissingFieldSchema),
    optionalFields: z.array(adhocOptionalFieldSchema),
  }),
  z.object({ phase: z.literal("checking_goal") }),
  z.object({ phase: z.literal("exploring") }),
  z.object({
    phase: z.literal("showing_exploration_candidates"),
    candidates: z.array(waymateCandidateSchema),
    chartUrl: z.string().url().nullable(),
    appliedFilters: currentAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
  }),
  z.object({
    phase: z.literal("showing_exploration_facets"),
    facets: candidateFacetsSchema,
    appliedFilters: currentAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
  }),
  z.object({ phase: z.literal("extracting_goal") }),
  z.object({
    phase: z.literal("showing_goal"),
    extractedGoal: targetContextSchema,
    goalOptionalFields: z.array(goalOptionalFieldSchema),
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
    phase: z.literal("asking_after_validate_candidates"),
    candidates: z.array(matchedCandidateWithPathSchema),
    chartUrl: z.string().url().nullable(),
    appliedFilters: targetAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
    extractedGoal: targetContextSchema.nullable(),
  }),
  z.object({
    phase: z.literal("asking_after_validate_facets"),
    facets: candidateFacetsSchema,
    appliedFilters: targetAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
    extractedGoal: targetContextSchema.nullable(),
  }),
  z.object({ phase: z.literal("setting_goal") }),
  z.object({
    phase: z.literal("asking_search_mode"),
    storedGoal: goalSchema,
  }),
  z.object({ phase: z.literal("deleting_goal") }),
  z.object({ phase: z.literal("searching") }),
  z.object({
    phase: z.literal("showing_waymate_results"),
    results: z.array(waymateCandidateSchema),
    resultsCount: z.number().int().nonnegative(),
    goal: targetContextSchema.nullable(),
    chartUrl: z.string().url().nullable(),
    appliedFilters: currentAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
    answerText: z.string().nullable(),
  }),
  z.object({
    phase: z.literal("showing_pathfinder_results"),
    results: z.array(pathfinderCandidateSchema),
    resultsCount: z.number().int().nonnegative(),
    goal: targetContextSchema.nullable(),
    chartUrl: z.string().url().nullable(),
    appliedFilters: currentAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
    answerText: z.string().nullable(),
  }),
  z.object({
    phase: z.literal("showing_results_facets"),
    facets: candidateFacetsSchema,
    goal: targetContextSchema.nullable(),
    appliedFilters: currentAppliedFiltersSchema.nullable(),
    adhocContext: adhocContextBase.nullable(),
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
  locale: localeSchema.optional().describe("User language for responses (en/ru, default: en)"),
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
  locale: localeSchema.optional().describe("User language for responses (en/ru, default: en)"),
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
  locale: localeSchema.optional().describe("User language for responses (en/ru, default: en)"),
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
  locale: localeSchema.optional().describe("User language for responses (en/ru, default: en)"),
});

export type McpColdStartParams = z.infer<typeof mcpColdStartParamsSchema>;

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
  locale: localeSchema.optional().describe("User language for responses (en/ru, default: en)"),
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

/**
 * Params for link_telegram MCP tool.
 * Links Telegram account to existing LibreChat account.
 */
export const mcpTelegramLinkParamsSchema = z.object({
  token: tokenSchema.describe("Token from LibreChat account to link"),
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
  requestId: requestIdSchema,
});

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

/**
 * Params for cancel_all_graphs MCP tool.
 * Cancels all active LangGraph sessions for user (clears checkpoints).
 */
export const mcpCancelAllGraphsParamsSchema = z.object({
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
});

export type McpCancelAllGraphsParams = z.infer<typeof mcpCancelAllGraphsParamsSchema>;

export const cancelAllGraphsResponseSchema = z.object({
  success: z.literal(true),
});
