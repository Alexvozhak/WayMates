/**
 * User Stories Loader
 *
 * Loads test user stories from JSON fixtures.
 * Maps user keys (U1-U18) to fixture files (tests/core/fixtures/U1.json - U18.json).
 * Files are validated with Zod storyInputSchema on load.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { storyInputSchema } from "../../../src/shared/schemas.js";

import type { StoryInput } from "../../../src/shared/schemas.js";

export type UserKey =
  | "U1"
  | "U2"
  | "U3"
  | "U4"
  | "U5"
  | "U6"
  | "U7"
  | "U8"
  | "U9"
  | "U10"
  | "U11"
  | "U12"
  | "U13"
  | "U14"
  | "U15"
  | "U16"
  | "U17"
  | "U18"
  | "U19";

export class UserStories {
  private readonly dataDir: string;
  private readonly cache = new Map<UserKey, StoryInput>();

  constructor() {
    this.dataDir = path.join(process.cwd(), "tests", "core", "fixtures");
  }

  getUserStories(keys: UserKey[]): StoryInput[] {
    return keys.map((key) => this.getStoryBy(key));
  }

  getStoryBy(key: UserKey): StoryInput {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const fileName = `${key}.json`;
    const filePath = path.join(this.dataDir, fileName);

    try {
      const content = readFileSync(filePath, "utf8");
      const json = JSON.parse(content);
      const story = storyInputSchema.parse(json);
      this.cache.set(key, story);
      return story;
    } catch (error) {
      throw new Error(
        `Failed to load test data for ${key} from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
