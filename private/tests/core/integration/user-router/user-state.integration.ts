/**
 * User State Integration Tests
 * Business rules:
 * - US1-US3: user.getState returns correct flags (hasContext, hasGoal)
 */

import { DatabaseContext } from "@core/database-context.js";
import { GoalsManager } from "@core/goals-manager.js";
import { createDriver } from "@core/neo4j.js";
import { StoryManager } from "@core/story-manager.js";
import { targetContextSchema } from "@shared/schemas.js";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseFixture } from "../../helpers/database-fixture.js";
import { createTestContext } from "../../helpers/test-data-factory.js";


import type { Driver } from "neo4j-driver";


let driver: Driver;
let db: DatabaseContext;
let storyManager: StoryManager;
let goalsManager: GoalsManager;
let dbFixture: DatabaseFixture;

beforeAll(() => {
  driver = createDriver();
  db = new DatabaseContext(driver);
  storyManager = new StoryManager(db);
  goalsManager = new GoalsManager(db);
  dbFixture = new DatabaseFixture(driver);
}, 30_000);

beforeEach(async () => {
  await dbFixture.cleanNodes("Goal", "User", "Context", "Trail");
}, 30_000);

afterAll(async () => {
  await driver.close();
}, 30_000);

async function getUserState(userId: string) {
  const [story, goal] = await Promise.all([storyManager.getUserStory(userId), goalsManager.getUserGoal(userId)]);

  return {
    hasContext: story.contexts.length > 0,
    hasGoal: goal !== null,
  };
}

describe("User State (US1-US3)", () => {
  it("US1: New user - all flags false", async () => {
    const userId = `usr_${uuidv7()}`;

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(false);
    expect(state.hasGoal).toBe(false);
  });

  it("US2: User with 1 context - hasContext=true", async () => {
    const userId = `usr_${uuidv7()}`;
    const contextId = `ctx_${uuidv7()}`;

    await storyManager.upsertContext({
      userId,
      context: createTestContext({
        contextId,
        position: "junior",
        domains: ["backend"],
        skills: ["python"],
        nextContextId: null,
      }),
    });

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(true);
    expect(state.hasGoal).toBe(false);
  });

  it("US3: User with goal - hasGoal=true", async () => {
    const userId = `usr_${uuidv7()}`;
    const contextId = `ctx_${uuidv7()}`;

    await storyManager.upsertContext({
      userId,
      context: createTestContext({
        contextId,
        position: "junior",
        domains: ["backend"],
        skills: ["python"],
        nextContextId: null,
      }),
    });

    await goalsManager.setGoal({
      userId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
      }),
    });

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(true);
    expect(state.hasGoal).toBe(true);
  });
});
