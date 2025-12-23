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
    expect(turn1.phase, "Turn 1: User without goal MUST start with exploration").toBe(PHASE.showing_exploration);

    if (turn1.phase !== PHASE.showing_exploration) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(turn1.candidates.length, "Turn 1: Exploration MUST return candidates with relaxed filters").toBeGreaterThan(
      0,
    );

    // Turn 2: User proceeds (готов сформулировать цель)
    const turn2 = await runGraph("хочу стать senior frontend разработчиком");
    expect(turn2.phase, "Turn 2: After exploration, user message MUST trigger goal extraction").toBe(
      PHASE.showing_goal,
    );

    if (turn2.phase !== PHASE.showing_goal) {
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

  /**
   * TC-SG-EX2: Filter intent → apply_filters → explore (no goal)
   *
   * Что тестируем:
   * Пользователь без цели применяет фильтры в exploration phase.
   * apply_filters node ДОЛЖЕН вернуть в explore (не в search).
   *
   * Инвариант: I13 — apply_filters БЕЗ цели → explore
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "покажи без учёта города и страны" → apply_filters → explore
   *
   * Then:
   * - Turn 1: phase = showing_exploration
   * - Turn 2: phase = showing_exploration (NOT showing_results!)
   * - Turn 2: appliedFilters.excludedContextFields contains geo fields
   *
   * Тип теста: Integration (multi-turn, real LLM)
   */
  it("TC-SG-EX2: filter intent → apply_filters → explore (no goal)", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: Initial exploration (with relaxed filters for stable results)
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase, "Turn 1: User without goal MUST start with exploration").toBe(PHASE.showing_exploration);

    if (turn1.phase !== PHASE.showing_exploration) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`TC-SG-EX2 [1/2]: ✅ Exploration started (${turn1.candidates.length} candidates)`);

    // Turn 2: Apply filter intent → should stay in exploration (not search)
    // KEY INVARIANT: without goal, apply_filters routes back to explore
    const turn2 = await runGraph("покажи без учёта города и страны");

    expect(
      turn2.phase,
      "Turn 2: Filter intent without goal MUST return to exploration (not search). " +
        "Invariant I13: apply_filters БЕЗ цели → explore",
    ).toBe(PHASE.showing_exploration);

    if (turn2.phase !== PHASE.showing_exploration) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify filter was applied (appliedFilters exists and contains geo fields)
    expect(turn2.appliedFilters, "Turn 2: appliedFilters MUST be present after filter intent").toBeDefined();

    const excludedFields = turn2.appliedFilters?.excludedContextFields ?? [];
    const hasGeoExcluded =
      excludedFields.some((f) => f.toLowerCase().includes("city")) ||
      excludedFields.some((f) => f.toLowerCase().includes("country"));

    expect(
      hasGeoExcluded,
      `Turn 2: LLM MUST extract geo fields from filter message, got: ${JSON.stringify(excludedFields)}`,
    ).toBe(true);

    console.log(`TC-SG-EX2 [2/2]: ✅ Filter applied → exploration (${turn2.candidates.length} candidates)`);
    console.log(`  Excluded fields: ${excludedFields.join(", ")}`);
  }, 180_000);
});
