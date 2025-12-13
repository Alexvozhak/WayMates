/**
 * User State Integration Tests
 * Business rules:
 * - US1-US4: user.getState returns correct flags (hasContext, hasTrajectory, hasGoal)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createDriver } from "../../../../src/core/neo4j.js";
import { DatabaseContext } from "../../../../src/core/database-context.js";
import { StoryManager } from "../../../../src/core/story-manager.js";
import { GoalsManager } from "../../../../src/core/goals-manager.js";
import { DatabaseFixture } from "../../helpers/database-fixture.js";
import { createTestContext } from "../../helpers/test-data-factory.js";
import { v7 as uuidv7 } from "uuid";
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
}, 30000);

beforeEach(async () => {
  await dbFixture.cleanNodes("Goal", "User", "Context", "Trail");
}, 30000);

afterAll(async () => {
  await driver.close();
}, 30000);

async function getUserState(userId: string) {
  const [story, goal] = await Promise.all([storyManager.getUserStory(userId), goalsManager.getUserGoal(userId)]);

  return {
    hasContext: story.contexts.length > 0,
    hasTrajectory: story.contexts.length > 1,
    hasGoal: goal !== null,
  };
}

describe("User State (US1-US4)", () => {
  it("US1: New user - all flags false", async () => {
    const userId = `usr_${uuidv7()}`;

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(false);
    expect(state.hasTrajectory).toBe(false);
    expect(state.hasGoal).toBe(false);
  });

  it("US2: User with 1 context - hasContext=true, hasTrajectory=false", async () => {
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
    expect(state.hasTrajectory).toBe(false);
    expect(state.hasGoal).toBe(false);
  });

  it("US3: User with 2+ contexts (trajectory) - hasTrajectory=true", async () => {
    const userId = `usr_${uuidv7()}`;
    const ctx1 = `ctx_${uuidv7()}`;
    const ctx2 = `ctx_${uuidv7()}`;

    await storyManager.upsertStory({
      userId,
      contexts: [
        createTestContext({
          contextId: ctx1,
          position: "junior",
          domains: ["backend"],
          skills: ["python"],
          createdAt: "2022-01-01T00:00:00Z",
          nextContextId: ctx2,
        }),
        createTestContext({
          contextId: ctx2,
          position: "middle",
          domains: ["backend"],
          skills: ["python", "go"],
          createdAt: "2023-01-01T00:00:00Z",
          nextContextId: null,
        }),
      ],
      trails: [],
    });

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(true);
    expect(state.hasTrajectory).toBe(true);
    expect(state.hasGoal).toBe(false);
  });

  it("US4: User with goal - hasGoal=true", async () => {
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
      targetContext: {
        position: { mode: "desired", values: ["senior"] },
      },
    });

    const state = await getUserState(userId);

    expect(state.hasContext).toBe(true);
    expect(state.hasTrajectory).toBe(false);
    expect(state.hasGoal).toBe(true);
  });
});
