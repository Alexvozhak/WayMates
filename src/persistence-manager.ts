import type {
  UserIdContext,
  UserIdTrail,
  GetUserStoryParams,
  DeleteContextParams,
  DeleteTrailParams,
  StoryInput,
  UpsertContextResult,
  ContextId,
  TrailId,
  UpsertTrailResult,
  UpsertStoryResult,
} from "./schemas-zod.js";
import type { Driver } from "neo4j-driver";
import {
  UPSERT_CONTEXTS_QUERY,
  UPSERT_TRAILS_QUERY,
  GET_USER_STORY_QUERY,
  DELETE_CONTEXT_QUERY,
  DELETE_TRAIL_QUERY,
} from "./persistence-query-builder.js";
import {
  ContextIdSchema,
  StoryInputSchema,
  TrailIdSchema,
  UpsertContextResultSchema,
  UpsertStoryResultSchema,
  UpsertTrailResultSchema,
} from "./schemas-zod.js";
import { withReadSession, withWriteSession } from "./neo4j.js";
import { ulid } from "ulid";

export class PersistenceManager {
  constructor(private driver: Driver) {}

  async upsertStory(params: StoryInput): Promise<UpsertStoryResult> {
    const contextsResult: UpsertContextResult = await this.upsertContexts({
      user_id: params.user_id,
      contexts: params.contexts,
    });
    const trailsResult: UpsertTrailResult = await this.upsertTrails({
      user_id: params.user_id,
      trails: params.trails,
    });
    return UpsertStoryResultSchema.parse({
      contexts: contextsResult,
      trails: trailsResult,
    });
  }

  async upsertContexts(params: UserIdContext): Promise<UpsertContextResult> {
    return withWriteSession(this.driver, async (tx) => {
      const results: ContextId[] = [];
      for (const context of params.contexts) {
        if (!context.context_id) {
          context.context_id = this.generateContextId();
        }

        const result = await tx.run(UPSERT_CONTEXTS_QUERY, {
          user_id: params.user_id,
          context,
        });
        const record = result.records[0];
        if (!record)
          throw new Error(
            `upsertContexts: no result returned for params ${JSON.stringify(params)}`
          );
        results.push(ContextIdSchema.parse(record.get("context_id")));
      }
      return UpsertContextResultSchema.parse({
        success: true,
        contextIds: results,
      });
    });
  }

  async upsertTrails(params: UserIdTrail): Promise<UpsertTrailResult> {
    return withWriteSession(this.driver, async (tx) => {
      const results: TrailId[] = [];
      for (const trail of params.trails) {
        const trail_id = this.generateTrailId();
        const result = await tx.run(UPSERT_TRAILS_QUERY, {
          trail_id,
          from_context_id: trail.from_context_id,
          to_context_id: trail.to_context_id,
          user_id: params.user_id,
          trail,
        });
        const record = result.records[0];
        if (!record)
          throw new Error(
            `upsertTrails: no result returned for params ${JSON.stringify(params)}`
          );
        results.push(TrailIdSchema.parse(record.get("trail_id")));
      }
      return UpsertTrailResultSchema.parse({
        success: true,
        trailIds: results,
      });
    });
  }

  async getUserStory(params: GetUserStoryParams): Promise<StoryInput> {
    return withReadSession(this.driver, async (tx) => {
      const result = await tx.run(GET_USER_STORY_QUERY, params);
      const record = result.records[0];
      if (!record)
        throw new Error(
          `getUserStory: no record returned for user ${params.user_id}`
        );
      return StoryInputSchema.parse(record.get("result"));
    });
  }

  async deleteContext(params: DeleteContextParams): Promise<boolean> {
    return withWriteSession(this.driver, async (session) => {
      const result = await session.run(DELETE_CONTEXT_QUERY, params);
      const record = result.records[0];
      if (!record)
        throw new Error(
          `deleteContext: no result returned for params ${JSON.stringify(params)}`
        );
      return Boolean(record.get("result"));
    });
  }

  async deleteTrail(params: DeleteTrailParams): Promise<boolean> {
    return withWriteSession(this.driver, async (session) => {
      const result = await session.run(DELETE_TRAIL_QUERY, params);
      const record = result.records[0];
      if (!record)
        throw new Error(
          `deleteTrail: no result returned for params ${JSON.stringify(params)}`
        );
      return Boolean(record.get("result"));
    });
  }

  async ping(): Promise<{ status: "ok"; timestamp: string }> {
    return withReadSession(this.driver, async (session) => {
      await session.run("RETURN 1 AS ok");
      return { status: "ok", timestamp: new Date().toISOString() };
    });
  }

  private generateContextId(): string {
    return `ctx_${ulid()}`;
  }

  private generateTrailId(): string {
    return `trl_${ulid()}`;
  }
}
