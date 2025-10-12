import type {
  UserIdContext,
  UserIdTrail,
  GetUserStoryParams,
  DeleteContextParams,
  DeleteTrailParams,
  StoryInput,
  SuccessResult,
} from "./schemas-zod.js";
import type { Driver } from "neo4j-driver";
import { PersistenceQueryBuilder } from "./persistence-query-builder.js";
import { StoryInputSchema, SuccessResultSchema } from "./schemas-zod.js";
import { withReadSession, withWriteSession } from "./neo4j.js";

/**
 * Manager for persistence operations: contexts, trails, story retrieval, and deletions.
 */
export class PersistenceManager {
  private builder = new PersistenceQueryBuilder();
  constructor(private driver: Driver) {}

  /** Create or update user contexts */
  async upsertContexts(params: UserIdContext): Promise<SuccessResult> {
    return withWriteSession(this.driver, async (session) => {
      for (const context of params.contexts) {
        await session.run(this.builder.buildUpsertContexts(), {
          user_id: params.user_id,
          context,
        });
      }
      return SuccessResultSchema.parse({ success: true });
    });
  }

  /** Create or update user trails */
  async upsertTrails(params: UserIdTrail): Promise<SuccessResult> {
    return withWriteSession(this.driver, async (session) => {
      for (const trail of params.trails) {
        await session.run(this.builder.buildUpsertTrails(), {
          user_id: params.user_id,
          trail,
        });
      }
      return SuccessResultSchema.parse({ success: true });
    });
  }

  /** Retrieve full user story (contexts + trails) */
  async getUserStory(params: GetUserStoryParams): Promise<StoryInput> {
    return withReadSession(this.driver, async (session) => {
      const result = await session.run(
        this.builder.buildGetUserStory(),
        params
      );
      const record = result.records[0];
      if (!record)
        throw new Error(
          `getUserStory: no record returned for user ${params.user_id}`
        );
      return StoryInputSchema.parse(record.get("result"));
    });
  }

  /** Delete a specific context */
  async deleteContext(params: DeleteContextParams): Promise<SuccessResult> {
    return withWriteSession(this.driver, async (session) => {
      const result = await session.run(
        this.builder.buildDeleteContext(),
        params
      );
      const record = result.records[0];
      if (!record)
        throw new Error(
          `deleteContext: no result returned for params ${JSON.stringify(params)}`
        );
      return SuccessResultSchema.parse(record.get("result"));
    });
  }

  /** Delete a specific trail */
  async deleteTrail(params: DeleteTrailParams): Promise<SuccessResult> {
    return withWriteSession(this.driver, async (session) => {
      const result = await session.run(this.builder.buildDeleteTrail(), params);
      const record = result.records[0];
      if (!record)
        throw new Error(
          `deleteTrail: no result returned for params ${JSON.stringify(params)}`
        );
      return SuccessResultSchema.parse(record.get("result"));
    });
  }

  /** Check database connectivity */
  async ping(): Promise<{ status: "ok"; timestamp: string }> {
    return withReadSession(this.driver, async (session) => {
      await session.run("RETURN 1 AS ok");
      return { status: "ok", timestamp: new Date().toISOString() };
    });
  }
  /**
   * Process complete user story: contexts + trails
   */
  async upsertStory(params: StoryInput): Promise<SuccessResult> {
    // Insert contexts then trails in one flow
    await this.upsertContexts({
      user_id: params.user_id,
      contexts: params.contexts,
    });
    await this.upsertTrails({ user_id: params.user_id, trails: params.trails });
    return { success: true };
  }
}
