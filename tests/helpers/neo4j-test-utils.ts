import type { Driver } from "neo4j-driver";
import { executeUpsertStory } from "../../src/persistence-manager.js";
import { loadTestData } from "./test-data-loader.js";

/**
 * Deletes all nodes and relationships in the database.
 */
export async function clearDb(driver: Driver): Promise<void> {
  await driver.executeWrite((tx) => tx.run("MATCH (n) DETACH DELETE n"));
}

/**
 * Seeds provided users (by keys) into database using upsertStory.
 */
export async function seedUsers(
  driver: Driver,
  userKeys: string[]
): Promise<void> {
  for (const key of userKeys) {
    const story = loadTestData(key);
    await executeUpsertStory(driver, story);
  }
}
