import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupUserGoal, runSearchGraphWithRelaxedFilters, TEST_USER_ID } from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph: Cancel (TC-SG-CANCEL)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_cancel_${testUserId}`;

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
   * TC-SG-CANCEL1: Cancel из exploration
   *
   * Что тестируем:
   * Пользователь может отменить workflow из exploration phase.
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "отмена" → cancel → END
   *
   * Then:
   * - Turn 2: phase = cancelled
   * - Goal НЕ создан в Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG-CANCEL1: cancel из exploration", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: Start exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase).toBe(PHASE.showing_exploration);

    console.log("TC-SG-CANCEL1 [1/2]: ✅ Exploration started");

    // Turn 2: Cancel
    const turn2 = await runGraph("отмена");
    expect(turn2.phase, "Turn 2: 'отмена' MUST trigger cancel phase").toBe(PHASE.cancelled);

    // Verify: goal NOT created
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST NOT be created after cancel").toBeNull();

    console.log("TC-SG-CANCEL1 [2/2]: ✅ Cancelled from exploration");
  }, 120_000);

  /**
   * TC-SG-CANCEL2: Cancel из showing_goal
   *
   * Что тестируем:
   * Пользователь может отменить workflow после формирования цели.
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   *
   * Flow:
   * - Turn 1: "ищу работу" → showing_exploration
   * - Turn 2: "хочу стать senior" → showing_goal
   * - Turn 3: "отмена" → cancel → END
   *
   * Then:
   * - Turn 3: phase = cancelled
   * - Goal НЕ сохранён в Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG-CANCEL2: cancel из showing_goal", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: Start exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase).toBe(PHASE.showing_exploration);

    console.log("TC-SG-CANCEL2 [1/3]: ✅ Exploration started");

    // Turn 2: Express goal
    const turn2 = await runGraph("хочу стать senior backend разработчиком");
    expect(turn2.phase, "Turn 2: Goal expression MUST trigger showing_goal").toBe(PHASE.showing_goal);

    console.log("TC-SG-CANCEL2 [2/3]: ✅ Goal extracted");

    // Turn 3: Cancel
    const turn3 = await runGraph("отмена");
    expect(turn3.phase, "Turn 3: 'отмена' MUST trigger cancel phase").toBe(PHASE.cancelled);

    // Verify: goal NOT saved
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST NOT be saved after cancel").toBeNull();

    console.log("TC-SG-CANCEL2 [3/3]: ✅ Cancelled from showing_goal");
  }, 180_000);
});
