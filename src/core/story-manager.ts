import {
  // CREATE_REASON_QUERY,
  DELETE_CONTEXT_QUERY,
  DELETE_STORY_QUERY,
  DELETE_TRAIL_QUERY,
  GET_USER_STORY_QUERY,
  //  LIST_REASONS_QUERY,
  UPSERT_CONTEXTS_QUERY,
  UPSERT_TRAILS_QUERY,
} from "../cypher/index.js";
import {
  contextIdSchema,
  coreUpdateContextParamsSchema,
  deleteStoryResultSchema,
  storyInputSchema,
  trailIdSchema,
  upsertContextInputSchema,
  upsertContextResultSchema,
  upsertStoryResultSchema,
  upsertTrailInputSchema,
  upsertTrailResultSchema,
} from "../shared/schemas.js";

import { upsertSingleContextResultSchema, upsertSingleTrailResultSchema } from "./schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type {
  ContextId,
  CoreUpdateContextParams,
  StoryInput,
  Trail,
  TrailId,
  UpsertContextInput,
  UpsertContextResult,
  UpsertSingleContextResult,
  UpsertSingleTrailResult,
  UpsertStoryResult,
  UpsertTrailInput,
  UpsertTrailResult,
  UserContext,
} from "../shared/schemas.js";

export class StoryManager {
  constructor(private db: DatabaseContext) {}

  async upsertStory(params: StoryInput): Promise<UpsertStoryResult> {
    const contextsResult: UpsertContextResult = await this.upsertContexts(params.userId, params.contexts);
    const trailsResult: UpsertTrailResult = await this.upsertTrails(params.userId, params.trails);
    return upsertStoryResultSchema.parse({
      contexts: contextsResult,
      trails: trailsResult,
    });
  }

  async getUserStory(userId: string): Promise<StoryInput> {
    return this.db.read(async (tx) => {
      const result = await tx.run(GET_USER_STORY_QUERY, { userId: userId });
      const record = result.records[0];
      if (!record) {
        // Return empty story for new users (cold-start flow)
        return { userId, contexts: [], trails: [] };
      }
      return storyInputSchema.parse(record.get("result"));
    });
  }

  async deleteContext(userId: string, contextId: string): Promise<boolean> {
    return this.db.write(async (tx) => {
      const result = await tx.run(DELETE_CONTEXT_QUERY, {
        userId: userId,
        contextId: contextId,
      });
      const record = result.records[0];
      if (!record) {
        // Idempotent: context not found = already deleted = false
        return false;
      }
      return Boolean(record.get("result").success);
    });
  }

  async deleteTrail(userId: string, trailId: string): Promise<boolean> {
    return this.db.write(async (tx) => {
      const result = await tx.run(DELETE_TRAIL_QUERY, {
        userId: userId,
        trailId: trailId,
      });
      const record = result.records[0];
      if (!record) {
        // Idempotent: trail not found = already deleted = false
        return false;
      }
      return Boolean(record.get("result").success);
    });
  }

  async deleteStory(userId: string): Promise<{ deletedContexts: number; deletedTrails: number }> {
    return this.db.write(async (tx) => {
      const result = await tx.run(DELETE_STORY_QUERY, { userId });
      const record = result.records[0];

      if (!record) {
        return { deletedContexts: 0, deletedTrails: 0 };
      }

      const queryResult = deleteStoryResultSchema.parse(record.get("result"));

      return {
        deletedContexts: queryResult.deletedContexts,
        deletedTrails: queryResult.deletedTrails,
      };
    });
  }

  async updateContext(params: CoreUpdateContextParams): Promise<UserContext> {
    coreUpdateContextParamsSchema.parse(params);

    let story: StoryInput;
    try {
      story = await this.getUserStory(params.userId);
    } catch {
      // getUserStory throws Zod validation error for users without contexts
      // Convert to business-friendly error message
      throw new Error(`Current context not found for user ${params.userId} or user has no contexts`);
    }

    const currentContext = story.contexts.find((ctx) => ctx.nextContextId === null);

    if (!currentContext) {
      throw new Error(`Current context not found for user ${params.userId} or user has no contexts`);
    }

    const definedUpdates = Object.fromEntries(
      Object.entries(params.updates).filter(([_, value]) => value !== undefined),
    );

    const updatedContext: UserContext = {
      ...currentContext,
      ...definedUpdates,
    };

    await this.upsertContext({
      userId: params.userId,
      context: updatedContext,
    });

    return updatedContext;
  }

  async upsertContext(params: UpsertContextInput): Promise<UpsertSingleContextResult> {
    upsertContextInputSchema.parse(params);

    return this.db.write(async (tx) => {
      const result = await tx.run(UPSERT_CONTEXTS_QUERY, {
        userId: params.userId,
        ctx: params.context,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`upsertContext: no result returned for user=${params.userId}`);
      }

      const contextId = contextIdSchema.parse(record.get("contextId"));
      return upsertSingleContextResultSchema.parse({
        success: true,
        contextId: contextId,
      });
    });
  }

  async upsertTrail(params: UpsertTrailInput): Promise<UpsertSingleTrailResult> {
    upsertTrailInputSchema.parse(params);

    return this.db.write(async (tx) => {
      const result = await tx.run(UPSERT_TRAILS_QUERY, {
        userId: params.userId,
        trailId: params.trail.trailId,
        trail: params.trail,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`upsertTrail: no result returned for user=${params.userId}`);
      }

      const resultTrailId = trailIdSchema.parse(record.get("trailId"));
      return upsertSingleTrailResultSchema.parse({
        success: true,
        trailId: resultTrailId,
      });
    });
  }

  private async upsertContexts(userId: string, contexts: UserContext[]): Promise<UpsertContextResult> {
    return this.db.write(async (tx) => {
      const results: ContextId[] = [];
      for (const context of contexts) {
        const result = await tx.run(UPSERT_CONTEXTS_QUERY, {
          userId,
          ctx: context,
        });
        const record = result.records[0];
        if (!record) {
          throw new Error(`upsertContexts: no result returned for user=${userId}`);
        }
        results.push(contextIdSchema.parse(record.get("contextId")));
      }
      return upsertContextResultSchema.parse({
        success: true,
        contextIds: results,
      });
    });
  }

  private async upsertTrails(userId: string, trails: Trail[]): Promise<UpsertTrailResult> {
    return this.db.write(async (tx) => {
      const results: TrailId[] = [];
      for (const trail of trails) {
        const result = await tx.run(UPSERT_TRAILS_QUERY, {
          userId,
          trailId: trail.trailId,
          trail,
        });
        const record = result.records[0];
        if (!record) {
          throw new Error(`upsertTrails: no result returned for user=${userId}`);
        }
        results.push(trailIdSchema.parse(record.get("trailId")));
      }
      return upsertTrailResultSchema.parse({
        success: true,
        trailIds: results,
      });
    });
  }
}
