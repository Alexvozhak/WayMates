import { z } from 'zod';

// Import shared schemas (domain entities)


// Re-export for Facade use


// ==========================================
// === FACADE-SPECIFIC TYPES ===
// ==========================================

// Auth Types
export type FacadeUser = {
  userId: string;
  token: string;
  createdAt: number;
  lastActiveAt?: number;
}

// Intent Types (discriminated union with Zod schemas)
export const intentSearchSchema = z.object({
  action: z.literal('search'),
  mode: z.enum(['fromCurrent', 'toTarget']),
});

export const intentStorySchema = z.object({
  action: z.literal('story'),
});

export const intentGoalSchema = z.object({
  action: z.literal('goal'),
  operation: z.enum(['create', 'get']),
});

export const intentSchema = z.discriminatedUnion('action', [
  intentSearchSchema,
  intentStorySchema,
  intentGoalSchema,
]);

export type IntentSearch = z.infer<typeof intentSearchSchema>;
export type IntentStory = z.infer<typeof intentStorySchema>;
export type IntentGoal = z.infer<typeof intentGoalSchema>;
export type Intent = z.infer<typeof intentSchema>;

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
}

export { type CreateGoalInput,type Goal, type StoryInput, type Trail, type UpsertStoryResult, type UserContext} from '../shared/schemas.js';