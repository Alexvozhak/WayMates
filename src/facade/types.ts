import { z } from 'zod';

// Import shared schemas (domain entities)
import type {
  UserContext,
  Trail,
  Goal,
  StoryInput,
  UpsertStoryResult,
  CreateGoalInput,
} from '../shared/schemas.js';

// Re-export for Facade use
export type { UserContext, Trail, Goal, StoryInput, UpsertStoryResult, CreateGoalInput };

// ==========================================
// === FACADE-SPECIFIC TYPES ===
// ==========================================

// Auth Types
export type FacadeUser = {
  userId: string;
  token: string;
  createdAt: number;
  lastActiveAt?: number;
};

// Intent Types (discriminated union with Zod schemas)
export const IntentSearchSchema = z.object({
  action: z.literal('search'),
  mode: z.enum(['fromCurrent', 'toTarget']),
});

export const IntentStorySchema = z.object({
  action: z.literal('story'),
});

export const IntentGoalSchema = z.object({
  action: z.literal('goal'),
  operation: z.enum(['create', 'get']),
});

export const IntentSchema = z.discriminatedUnion('action', [
  IntentSearchSchema,
  IntentStorySchema,
  IntentGoalSchema,
]);

export type IntentSearch = z.infer<typeof IntentSearchSchema>;
export type IntentStory = z.infer<typeof IntentStorySchema>;
export type IntentGoal = z.infer<typeof IntentGoalSchema>;
export type Intent = z.infer<typeof IntentSchema>;

// Core Tool Types
export type CoreToolName =
  | 'executeSearchFromCurrent'
  | 'executeSearchToTarget'
  | 'executeUpsertStory'
  | 'createGoal'
  | 'getUserGoals';

// Facade Response Types
export type FacadeResponse = {
  message: string;
  data?: unknown;
};
