import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";
import { targetContextSchema } from "../../../../../src/shared/schemas.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph: Persistence (TC-SG-PS)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_ps_${testUserId}`;

  const runGraph = (message: string) => {
    const ctx = FacadeTestContext.getInstance();
    return runSearchGraphWithRelaxedFilters(ctx.getGraphDeps(), message, threadId, testUserId);
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
    await cleanupUserGoal(ctx.coreClient, testUserId);
  });

  /**
   * TC-SG-PS1: set_goal saves to Neo4j
   *
   * Что тестируем:
   * После сохранения цели она персистится в Neo4j.
   * Следующий запуск с чистым checkpoint должен пропустить explore.
   *
   * Given:
   * - User: U1 (без goal)
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "хочу стать senior" → extract_goal → showing_goal
   * - Turn 3: "save" → set_goal → search → showing_results
   *
   * Then:
   * - Goal exists in Neo4j after Turn 3
   * - New run with clean checkpoint → showing_results (skips explore)
   *
   * Тип теста: Integration (multi-turn, Neo4j persistence)
   */
  it("TC-SG-PS1: set_goal saves to Neo4j", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: start exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase).toBe(PHASE.showing_exploration_candidates);

    // Turn 2: express goal intent
    const turn2 = await runGraph("хочу стать senior разработчиком");
    expect(turn2.phase).toBe(PHASE.showing_goal);

    // Turn 3: save goal
    const turn3 = await runGraph("save");
    expect(turn3.phase).toBe(PHASE.showing_results);

    // Verify: goal persisted in Neo4j
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be saved to Neo4j after 'save' command").not.toBeNull();
    // Check that LLM extracted "senior" in some form (may be "senior developer", "senior", etc.)
    const positionValues = goal?.targetContext.position?.values ?? [];
    expect(
      positionValues.some((v) => v.toLowerCase().includes("senior")),
      `Expected position to contain "senior", got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    // Verify: new session with clean checkpoint shows goal for review first (new architecture)
    await ctx.checkpointService.delete(threadId);
    const newSession = await runGraph("покажи результаты");
    expect(newSession.phase, "New session with persisted goal MUST show goal for review first").toBe(
      PHASE.showing_goal,
    );

    console.log("TC-SG-PS1: ✅ Goal saved to Neo4j, new session shows goal for review");
  }, 180_000);

  /**
   * TC-SG-PS2: delete_goal removes from Neo4j → explore
   *
   * Что тестируем:
   * Удаление цели убирает её из Neo4j и возвращает в explore.
   *
   * Given:
   * - User: U1 с goal в Neo4j
   *
   * Flow:
   * - Turn 1: "покажи" → showing_goal (review existing goal first)
   * - Turn 2: "save" → showing_results (confirm and search)
   * - Turn 3: "delete" → delete_goal → explore → showing_exploration
   *
   * Then:
   * - Goal deleted from Neo4j after Turn 3
   * - Phase: showing_exploration
   *
   * Тип теста: Integration (multi-turn, Neo4j persistence)
   */
  it("TC-SG-PS2: delete_goal removes from Neo4j", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Setup: create goal
    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
      }),
    });

    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // Turn 1: user with goal sees goal for review first
    const turn1 = await runGraph("покажи результаты");
    expect(turn1.phase, "User with goal MUST see goal for review first").toBe(PHASE.showing_goal);

    // Turn 2: confirm to get search results (delete is only available from showing_results)
    const turn2 = await runGraph("save");
    expect(turn2.phase, "After confirm, user MUST see search results").toBe(PHASE.showing_results);

    // Turn 3: delete goal
    const turn3 = await runGraph("delete");
    expect(turn3.phase, "After delete, user should return to exploration").toBe(PHASE.showing_exploration_candidates);

    // Verify: goal deleted from Neo4j
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be deleted from Neo4j after 'delete' command").toBeNull();

    console.log("TC-SG-PS2: ✅ Goal deleted from Neo4j, returned to explore");
  }, 240_000);
});
