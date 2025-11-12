import type { Driver } from 'neo4j-driver';
import { DatabaseContext } from '../../src/database-context.js';
import { StoryManager } from '../../src/core/story-manager.js';
import type { StoryInput } from '../../src/schemas-zod.js';

/**
 * Import multiple stories into the database
 * Uses StoryManager to handle context and trail creation
 */
export async function importStories(driver: Driver, stories: StoryInput[]): Promise<void> {
  const db = new DatabaseContext(driver);
  const storyManager = new StoryManager(db);

  for (const story of stories) {
    await storyManager.upsertStory(story);
  }
}
