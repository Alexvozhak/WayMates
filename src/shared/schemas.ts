import { z } from "zod";
import { REASON_IDS } from "../../database/reasons.js";

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
export const GOAL_ID_PATTERN = `^goal_${UUID_V7_PATTERN}$`;

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

export const GoalIdSchema = z
  .string()
  .regex(new RegExp(GOAL_ID_PATTERN), "Goal ID must be in format goal_<UUID>")
  .describe("Goal ID in format goal_<UUID>");

export type UserId = z.infer<typeof UserIdSchema>;
export type ContextId = z.infer<typeof ContextIdSchema>;
export type TrailId = z.infer<typeof TrailIdSchema>;
export type GoalId = z.infer<typeof GoalIdSchema>;

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const NewContextReasonSchema = z.enum(REASON_IDS);

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
  position: z.string().min(1).describe("Position title"),
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

export const TargetContextSchema = z.object({
  position: z
    .object({
      included: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Target positions (included/excluded)"),
  country: z
    .object({
      included: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Target countries (included/excluded)"),
  domains: z
    .object({
      included: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Target work domains (included/excluded)"),
  skills: z
    .object({
      included: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Target skills (included/excluded)"),
});

export type TargetContext = z.infer<typeof TargetContextSchema>;

// ==========================================
// === STORY & GOAL OPERATIONS ===
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

export const GoalSchema = z.object({
  goal_id: GoalIdSchema,
  user_id: UserIdSchema,
  target_context_id: ContextIdSchema.describe("Reference to target Context"),
  created_at: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When goal was created (ISO 8601 format)"),
});

export const CreateGoalInputSchema = z.object({
  userId: UserIdSchema,
  targetContextId: ContextIdSchema,
});

export type StoryInput = z.infer<typeof StoryInputSchema>;
export type UpsertContextResult = z.infer<typeof UpsertContextResultSchema>;
export type UpsertTrailResult = z.infer<typeof UpsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof UpsertStoryResultSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;
