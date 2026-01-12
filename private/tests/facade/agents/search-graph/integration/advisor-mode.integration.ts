import { targetContextSchema } from "@shared/schemas.js";
import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";

import type { UserId } from "@shared/schemas.js";

describe("SearchGraph: Advisor Mode (TC-SG-ADV)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_adv_${testUserId}`;

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
   * TC-SG-ADV1: Question from showing_results → answer in same phase
   *
   * After removing advising phase, questions are answered within showing_*_results phase.
   * Response includes answerText field when advisor generates an answer.
   *
   * Flow:
   * - Turn 1: "покажи результаты" → showing_goal
   * - Turn 2: "save" → asking_search_mode
   * - Turn 3: "проводники" → showing_pathfinder_results
   * - Turn 4: "расскажи про первого" → showing_pathfinder_results (with answerText)
   */
  it("TC-SG-ADV1: question from showing_results → answer in answerText", async () => {
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    // Turn 1: Get to showing_goal
    const turn1 = await runGraph("покажи результаты");
    expect(turn1.phase).toBe(PHASE.showing_goal);
    console.log("TC-SG-ADV1 [1/4]: ✅ Goal shown");

    // Turn 2: Save goal → asking_search_mode
    const turn2 = await runGraph("save");
    expect(turn2.phase).toBe(PHASE.asking_search_mode);
    console.log("TC-SG-ADV1 [2/4]: ✅ Asking search mode");

    // Turn 3: Choose pathfinders → showing_pathfinder_results
    const turn3 = await runGraph("проводники");
    expect(turn3.phase).toBe(PHASE.showing_pathfinder_results);

    if (turn3.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    const resultsCount = turn3.results.length;
    console.log(`TC-SG-ADV1 [3/4]: ✅ Search results (${resultsCount} candidates)`);

    // Turn 4: Ask question → stays in showing_pathfinder_results but with answerText
    const turn4 = await runGraph("расскажи подробнее про первого кандидата");

    expect(turn4.phase, "Phase stays showing_pathfinder_results").toBe(PHASE.showing_pathfinder_results);

    if (turn4.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    expect(turn4.answerText, "Advisor MUST provide non-empty answer").toBeTruthy();
    expect(turn4.answerText!.length, "Answer should be substantial (>50 chars)").toBeGreaterThan(50);

    console.log(`TC-SG-ADV1 [4/4]: ✅ Answer received in answerText`);
    console.log(`  Answer length: ${turn4.answerText!.length} chars`);
    console.log(`  Answer preview: ${turn4.answerText!.slice(0, 100)}...`);
  }, 360_000);

  /**
   * TC-SG-ADV2: Multi-turn advisor conversation
   *
   * Multiple questions in a row — each returns answerText.
   */
  it("TC-SG-ADV2: multi-turn advisor conversation", async () => {
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    // Get to showing_pathfinder_results
    await runGraph("покажи результаты");
    await runGraph("save");
    await runGraph("проводники");

    // Turn 4: First question
    const turn4 = await runGraph("чем отличается первый кандидат от второго?");
    expect(turn4.phase).toBe(PHASE.showing_pathfinder_results);

    if (turn4.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    const firstAnswer = turn4.answerText;
    expect(firstAnswer, "First answer must exist").toBeTruthy();
    console.log(`TC-SG-ADV2 [1/2]: ✅ First question answered (${firstAnswer!.length} chars)`);

    // Turn 5: Second question
    const turn5 = await runGraph("какие навыки мне нужно изучить?");
    expect(turn5.phase).toBe(PHASE.showing_pathfinder_results);

    if (turn5.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    expect(turn5.answerText, "Second answer MUST be provided").toBeTruthy();
    expect(turn5.answerText, "Second answer MUST be different from first").not.toBe(firstAnswer);

    console.log(`TC-SG-ADV2 [2/2]: ✅ Second question answered (${turn5.answerText!.length} chars)`);
  }, 420_000);

  /**
   * TC-SG-ADV3: Exit advisor mode with "done"
   *
   * User says "done" → returns to showing results (same phase, clears answerText).
   */
  it("TC-SG-ADV3: exit advisor mode with done", async () => {
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    // Get to showing_pathfinder_results with an answer
    await runGraph("покажи результаты");
    await runGraph("save");
    await runGraph("проводники");
    const withAnswer = await runGraph("расскажи про кандидатов");
    expect(withAnswer.phase).toBe(PHASE.showing_pathfinder_results);

    if (withAnswer.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    expect(withAnswer.answerText, "Answer should be present").toBeTruthy();
    console.log("TC-SG-ADV3 [1/2]: ✅ Got answer");

    // Exit with "done" — returns to showing results
    const exit = await runGraph("готово, хватит вопросов");
    expect(exit.phase).toBe(PHASE.showing_pathfinder_results);

    console.log("TC-SG-ADV3 [2/2]: ✅ Returned to results after done");
  }, 360_000);
});
