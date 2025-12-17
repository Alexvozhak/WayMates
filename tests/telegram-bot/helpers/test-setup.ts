import { afterAll, beforeAll } from "vitest";

import { UserStories } from "../../core/helpers/user-stories.js";

import { TelegramTestContext } from "./test-context.js";

import type { UserKey } from "../../core/helpers/user-stories.js";

beforeAll(async () => {
  console.log("[Telegram Setup] Starting telegram test infrastructure...");

  await TelegramTestContext.initialize();

  console.log("[Telegram Setup] Loading fixtures via Core tRPC...");
  const storiesToLoad: UserKey[] = ["U1", "U2", "U3", "U8", "U10", "U11"];
  await loadFixturesViaTRPC(storiesToLoad);

  console.log("[Telegram Setup] Telegram infrastructure ready ✓");
});

afterAll(async () => {
  console.log("[Telegram Cleanup] Closing connections...");
  await TelegramTestContext.getInstance().cleanup();
  console.log("[Telegram Cleanup] Cleanup complete ✓");
});

async function loadFixturesViaTRPC(storiesToLoad: UserKey[]): Promise<void> {
  const ctx = TelegramTestContext.getInstance();
  const userStories = new UserStories();

  for (const userKey of storiesToLoad) {
    const story = userStories.getStoryBy(userKey);

    console.log(`[Telegram Setup] Loading ${userKey} via tRPC...`);

    try {
      await ctx.coreClient.client.story.upsertStory.mutate({
        userId: story.userId,
        contexts: story.contexts,
        trails: story.trails,
      });
      console.log(`[Telegram Setup] ${userKey} loaded successfully`);
    } catch (error) {
      console.error(`[Telegram Setup] FAILED to load ${userKey}:`, error);
      throw error;
    }
  }

  console.log(`[Telegram Setup] Loaded ${storiesToLoad.length} user stories ✓`);
}
