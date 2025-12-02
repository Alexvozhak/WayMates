import { afterAll, beforeAll } from "vitest";

import { postgresService } from "../../../src/facade/infrastructure/postgres.service.js";
import { UserStories } from "../../core/helpers/user-stories.js";

import { FacadeTestContext } from "./test-context.js";

import type { UserKey } from "../../core/helpers/user-stories.js";

beforeAll(async () => {
  console.log("[Facade Setup] Starting facade test infrastructure...");

  console.log("[Facade Setup] Initializing PostgreSQL connection...");
  await postgresService.initialize();

  const ctx = FacadeTestContext.initialize();

  console.log("[Facade Setup] Invalidating cache to ensure fresh dictionary data...");
  await ctx.cache.invalidate();

  console.log("[Facade Setup] Loading fixtures via Core tRPC...");
  const storiesToLoad: UserKey[] = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];
  await loadFixturesViaTRPC(storiesToLoad);

  console.log("[Facade Setup] Facade infrastructure ready ✓");
});

afterAll(async () => {
  console.log("[Facade Cleanup] Closing Redis connection...");
  await FacadeTestContext.getInstance().cleanup();
  console.log("[Facade Cleanup] Closing PostgreSQL connection...");
  await postgresService.close();
  console.log("[Facade Cleanup] Cleanup complete ✓");
});

async function loadFixturesViaTRPC(storiesToLoad: UserKey[]): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  const userStories = new UserStories();

  for (const userKey of storiesToLoad) {
    const story = userStories.getStoryBy(userKey);

    console.log(`[Facade Setup] Loading ${userKey} via tRPC...`);

    try {
      await ctx.coreClient.client.story.upsertStory.mutate({
        userId: story.userId,
        contexts: story.contexts,
        trails: story.trails,
      });
      console.log(`[Facade Setup] ${userKey} loaded successfully`);
    } catch (error) {
      console.error(`[Facade Setup] FAILED to load ${userKey}:`, error);
      throw error;
    }
  }

  console.log(`[Facade Setup] Loaded ${storiesToLoad.length} user stories ✓`);
}
