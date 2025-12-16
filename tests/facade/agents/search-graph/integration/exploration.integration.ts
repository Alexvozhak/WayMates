import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupUserGoal, runSearchGraphWithRelaxedFilters, TEST_USER_ID } from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph: Exploration (TC-SG-EX)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_ex_${testUserId}`;

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
   * TC-SG-EX1: Explore → proceed → extract_goal
   *
   * Что тестируем:
   * Пользователь без цели видит exploration results, затем выбирает "proceed" (определился).
   * Graph переходит к извлечению цели из следующего сообщения.
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "proceed" → extract_goal → showing_goal
   *
   * Then:
   * - Turn 1: phase = showing_exploration, candidates.length > 0
   * - Turn 2: phase = showing_goal, extractedGoal extracted
   *
   * Тип теста: Integration (multi-turn, real LLM)
   */
  it("TC-SG-EX1: explore → proceed → extract_goal", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: Initial exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase, "Turn 1: User without goal MUST start with exploration").toBe(PHASE.showingExploration);

    if (turn1.phase !== PHASE.showingExploration) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(turn1.candidates.length, "Turn 1: Exploration MUST return candidates with relaxed filters").toBeGreaterThan(
      0,
    );

    // Turn 2: User proceeds (готов сформулировать цель)
    const turn2 = await runGraph("хочу стать senior frontend разработчиком");
    expect(turn2.phase, "Turn 2: After exploration, user message MUST trigger goal extraction").toBe(PHASE.showingGoal);

    if (turn2.phase !== PHASE.showingGoal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify LLM extracted position from message
    const positionValues = turn2.extractedGoal.position?.values ?? [];
    expect(
      positionValues.some((v) => v.toLowerCase().includes("senior")),
      `Turn 2: LLM MUST extract "senior" from user message, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    console.log("TC-SG-EX1: ✅ Explore → proceed → extract_goal");
  }, 180_000);
});
