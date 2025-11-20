import type { Driver } from "neo4j-driver";
import { DatabaseContext } from "../../../src/core/database-context.js";
import { StoryManager } from "../../../src/core/story-manager.js";
import type { StoryInput } from "../../../src/shared/schemas.js";

/**
 * Import multiple stories into the database
 * Uses StoryManager to handle context and trail creation
 */
export async function importStories(driver: Driver, stories: StoryInput[]): Promise<void> {
  const db = new DatabaseContext(driver);
  const storyManager = new StoryManager(db);

  for (const story of stories) {
    console.log(
      `[Import] Importing ${story.userId}, first context position: ${story.contexts[0]?.position}`,
    );
    await storyManager.upsertStory(story);
  }
}
