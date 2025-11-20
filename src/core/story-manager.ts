import { v7 as uuidv7 } from "uuid";

import {
  // CREATE_REASON_QUERY,
  DELETE_CONTEXT_QUERY,
  DELETE_TRAIL_QUERY,
  GET_USER_STORY_QUERY,
  //  LIST_REASONS_QUERY,
  UPDATE_CONTEXT_QUERY,
  UPSERT_CONTEXTS_QUERY,
  UPSERT_TRAILS_QUERY,
} from "../cypher/index.js";
import {
  contextIdSchema,
  storyInputSchema,
  trailIdSchema,
  updateContextParamsSchema,
  upsertContextResultSchema,
  upsertStoryResultSchema,
  upsertTrailResultSchema,
  userContextSchema,
} from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type {
  ContextId,
  StoryInput,
  Trail,
  TrailId,
  UpdateContextParams,
  UpsertContextResult,
  UpsertStoryResult,
  UpsertTrailResult,
  UserContext,
} from "../shared/schemas.js";

export class StoryManager {
  constructor(private db: DatabaseContext) {}

  async upsertStory(params: StoryInput): Promise<UpsertStoryResult> {
    const contextsResult: UpsertContextResult = await this.upsertContexts(
      params.userId,
      params.contexts,
    );
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
        throw new Error(`getUserStory: no record returned for user ${userId}`);
      }
      return storyInputSchema.parse(record.get("result"));
    });
  }

  async deleteContext(userId: string, contextId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_CONTEXT_QUERY, {
        userId: userId,
        contextId: contextId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(
          `deleteContext: no result returned for user=${userId}, context=${contextId}`,
        );
      }
      return Boolean(record.get("result"));
    });

    if (!success) {
      throw new Error(`Failed to delete context ${contextId}`);
    }
  }

  async deleteTrail(userId: string, trailId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_TRAIL_QUERY, {
        userId: userId,
        trailId: trailId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(`deleteTrail: no result returned for user=${userId}, trail=${trailId}`);
      }
      return Boolean(record.get("result"));
    });

    if (!success) {
      throw new Error(`Failed to delete trail ${trailId}`);
    }
  }

  async updateContext(params: UpdateContextParams): Promise<UserContext> {
    updateContextParamsSchema.parse(params);

    return this.db.write(async (tx) => {
      const result = await tx.run(UPDATE_CONTEXT_QUERY, {
        userId: params.userId,
        updates: params.updates,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(
          `Current context not found for user ${params.userId} or user has no contexts`,
        );
      }

      return userContextSchema.parse(record.get("result"));
    });
  }

  private async upsertContexts(
    userId: string,
    contexts: UserContext[],
  ): Promise<UpsertContextResult> {
    return this.db.write(async (tx) => {
      const results: ContextId[] = [];
      for (const context of contexts) {
        const contextWithId = Object.assign({}, context, {
          contextId: context.contextId || this.generateContextId(),
        });

        const result = await tx.run(UPSERT_CONTEXTS_QUERY, {
          userId,
          ctx: contextWithId,
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
        const trailId = this.generateTrailId();
        const result = await tx.run(UPSERT_TRAILS_QUERY, {
          userId,
          trailId,
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

  private generateContextId(): string {
    return `ctx_${uuidv7()}`;
  }

  private generateTrailId(): string {
    return `trl_${uuidv7()}`;
  }
}
