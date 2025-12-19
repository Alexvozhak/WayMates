import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupUserGoal, runSearchGraphWithRelaxedFilters, TEST_USER_ID } from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph: Clarify Intent (TC-SG-CI)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_ci_${testUserId}`;

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
   * TC-SG-CI1: Unknown intent triggers clarify_intent
   *
   * Что тестируем:
   * Непонятное сообщение вызывает clarify_intent node.
   * Граф остаётся в текущей фазе, LLM переспрашивает.
   *
   * Given:
   * - User: U1 (без goal)
   * - Turn 2: gibberish message
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "asdfghjkl" (gibberish) → clarify_intent → showing_exploration
   *
   * Then:
   * - Turn 2: phase = showing_exploration (остаётся в той же фазе)
   * - Workflow НЕ падает
   *
   * Note: LLM может попытаться интерпретировать gibberish.
   * Тест проверяет graceful handling, не конкретный intent.
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG-CI1: unknown intent triggers clarify_intent", async () => {
    // Turn 1: Start exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase).toBe(PHASE.showing_exploration);

    console.log("TC-SG-CI1 [1/2]: ✅ Exploration started");

    // Turn 2: Send gibberish → should trigger clarify_intent or graceful handling
    const turn2 = await runGraph("qwerty asdfgh zxcvbn 12345");

    // Graceful handling: should stay in exploration or ask for clarification
    // NOT failed, NOT showing_results (no goal)
    const isValidPhase =
      turn2.phase === PHASE.showing_exploration ||
      turn2.phase === PHASE.showing_goal ||
      turn2.phase === PHASE.cancelled;

    expect(isValidPhase, `Turn 2: Gibberish message MUST be handled gracefully. Got: ${turn2.phase}`).toBe(true);

    expect(turn2.phase, "Turn 2: Should NOT be failed phase").not.toBe(PHASE.failed);

    console.log(`TC-SG-CI1 [2/2]: ✅ Gibberish handled gracefully → phase: ${turn2.phase}`);
  }, 120_000);
});
