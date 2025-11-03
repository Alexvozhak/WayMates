import type { DatabaseContext } from '../database-context.js';
import type {
  StoryInput,
  UpsertStoryResult,
  UpsertContextResult,
  UpsertTrailResult,
  ContextId,
  TrailId,
  UserContext,
  Trail,
} from '../shared/schemas.js';
import {
  ContextIdSchema,
  StoryInputSchema,
  TrailIdSchema,
  UpsertContextResultSchema,
  UpsertStoryResultSchema,
  UpsertTrailResultSchema,
} from '../shared/schemas.js';
import { v7 as uuidv7 } from 'uuid';
import {
  UPSERT_CONTEXTS_QUERY,
  UPSERT_TRAILS_QUERY,
  GET_USER_STORY_QUERY,
  DELETE_CONTEXT_QUERY,
  DELETE_TRAIL_QUERY,
  LIST_REASONS_QUERY,
  CREATE_REASON_QUERY,
} from './persistence-query-builder.js';
import { ReasonSchema, type Reason } from './schemas.js';

export class StoryManager {
  constructor(private db: DatabaseContext) {}

  async upsertStory(params: StoryInput): Promise<UpsertStoryResult> {
    const contextsResult: UpsertContextResult = await this.upsertContexts(
      params.user_id,
      params.contexts
    );
    const trailsResult: UpsertTrailResult = await this.upsertTrails(
      params.user_id,
      params.trails
    );
    return UpsertStoryResultSchema.parse({
      contexts: contextsResult,
      trails: trailsResult,
    });
  }

  async getUserStory(userId: string): Promise<StoryInput> {
    return this.db.read(async (tx) => {
      const result = await tx.run(GET_USER_STORY_QUERY, { user_id: userId });
      const record = result.records[0];
      if (!record) {
        throw new Error(`getUserStory: no record returned for user ${userId}`);
      }
      return StoryInputSchema.parse(record.get('result'));
    });
  }

  async deleteContext(userId: string, contextId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_CONTEXT_QUERY, {
        user_id: userId,
        context_id: contextId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(
          `deleteContext: no result returned for user=${userId}, context=${contextId}`
        );
      }
      return Boolean(record.get('result'));
    });

    if (!success) {
      throw new Error(`Failed to delete context ${contextId}`);
    }
  }

  async deleteTrail(userId: string, trailId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_TRAIL_QUERY, {
        user_id: userId,
        trail_id: trailId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(
          `deleteTrail: no result returned for user=${userId}, trail=${trailId}`
        );
      }
      return Boolean(record.get('result'));
    });

    if (!success) {
      throw new Error(`Failed to delete trail ${trailId}`);
    }
  }

  async listAvailableReasons(): Promise<Reason[]> {
    return this.db.read(async (tx) => {
      const result = await tx.run(LIST_REASONS_QUERY);
      return result.records.map((rec) => {
        const reasonData = rec.get('reason');
        return ReasonSchema.parse(reasonData);
      });
    });
  }

  async createNewReason(
    reasonId: string,
    description: string,
    patterns: string[],
    examples: string[],
    contextId: string
  ): Promise<Reason> {
    return this.db.write(async (tx) => {
      const result = await tx.run(CREATE_REASON_QUERY, {
        reasonId,
        description,
        patterns,
        examples,
        contextId,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(
          `createNewReason: no result returned for reason_id ${reasonId}`
        );
      }

      const reasonData = record.get('r');
      return ReasonSchema.parse(reasonData.properties);
    });
  }

  private async upsertContexts(
    userId: string,
    contexts: UserContext[]
  ): Promise<UpsertContextResult> {
    return this.db.write(async (tx) => {
      const results: ContextId[] = [];
      for (const context of contexts) {
        const contextWithId = Object.assign({}, context, {
          context_id: context.context_id || this.generateContextId(),
        });

        const result = await tx.run(UPSERT_CONTEXTS_QUERY, {
          user_id: userId,
          context: contextWithId,
        });
        const record = result.records[0];
        if (!record) {
          throw new Error(
            `upsertContexts: no result returned for user=${userId}`
          );
        }
        results.push(ContextIdSchema.parse(record.get('context_id')));
      }
      return UpsertContextResultSchema.parse({
        success: true,
        contextIds: results,
      });
    });
  }

  private async upsertTrails(
    userId: string,
    trails: Trail[]
  ): Promise<UpsertTrailResult> {
    return this.db.write(async (tx) => {
      const results: TrailId[] = [];
      for (const trail of trails) {
        const trail_id = this.generateTrailId();
        const result = await tx.run(UPSERT_TRAILS_QUERY, {
          trail_id,
          from_context_id: trail.from_context_id,
          to_context_id: trail.to_context_id,
          user_id: userId,
          trail,
        });
        const record = result.records[0];
        if (!record) {
          throw new Error(`upsertTrails: no result returned for user=${userId}`);
        }
        results.push(TrailIdSchema.parse(record.get('trail_id')));
      }
      return UpsertTrailResultSchema.parse({
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
