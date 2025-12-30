import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { targetContextSchema } from "../../../../../src/shared/schemas.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

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
   * TC-SG-ADV1: Вопрос из showing_results → переход в advising
   *
   * Что тестируем:
   * Пользователь получил результаты поиска (кандидаты показаны) и задаёт вопрос.
   * parse_search_intent ДОЛЖЕН распознать intent=ask и перейти в answer_question node.
   * Advisor ДОЛЖЕН ответить на вопрос на основе контекста (searchResults, userTrajectory, goal).
   *
   * Инвариант: I20 — ask intent из showing_results → advising phase
   *
   * Given:
   * - User: U1 с goal в Neo4j
   * - User дошёл до showing_results (есть кандидаты для анализа)
   *
   * Flow:
   * - Turn 1: "покажи результаты" → load_existing_goal → showing_goal
   * - Turn 2: "save" → set_goal → asking_search_mode (new flow!)
   * - Turn 3: "проводники" → search_pathfinders → showing_results
   * - Turn 4: "расскажи про первого" → parse_search_intent(ask) → answer_question → advising
   *
   * Then:
   * - Turn 4: phase = advising (НЕ showing_results, НЕ clarify_intent)
   * - Turn 4: answerText непустой и содержательный (>50 символов)
   *
   * Тип теста: Integration (multi-turn, real LLM)
   */
  it("TC-SG-ADV1: question from showing_results → advising phase", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Setup: create goal
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

    // Turn 2: Save goal → asking_search_mode (new flow)
    const turn2 = await runGraph("save");
    expect(turn2.phase, "Save MUST transition to asking_search_mode").toBe(PHASE.asking_search_mode);
    console.log("TC-SG-ADV1 [2/4]: ✅ Asking search mode");

    // Turn 3: Choose pathfinders → showing_pathfinder_results
    const turn3 = await runGraph("проводники");
    expect(turn3.phase).toBe(PHASE.showing_pathfinder_results);

    if (turn3.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed");
    }

    const resultsCount = turn3.results.length;
    console.log(`TC-SG-ADV1 [3/4]: ✅ Search results (${resultsCount} candidates)`);

    // Turn 4: Ask question → advising
    const turn4 = await runGraph("расскажи подробнее про первого кандидата");

    expect(turn4.phase, "Question intent MUST transition to advising phase").toBe(PHASE.advising);

    if (turn4.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    expect(turn4.answerText, "Advisor MUST provide non-empty answer").toBeTruthy();
    expect(turn4.answerText.length, "Answer should be substantial (>50 chars)").toBeGreaterThan(50);

    console.log(`TC-SG-ADV1 [4/4]: ✅ Advisor mode activated`);
    console.log(`  Answer length: ${turn4.answerText.length} chars`);
    console.log(`  Answer preview: ${turn4.answerText.slice(0, 100)}...`);
  }, 360_000);

  /**
   * TC-SG-ADV2: Multi-turn диалог в режиме консультации
   *
   * Что тестируем:
   * Пользователь в режиме консультации (advising) задаёт второй вопрос.
   * parse_advisor_intent ДОЛЖЕН распознать intent=ask и вернуть в answer_question (loop).
   * Advisor ДОЛЖЕН ответить на новый вопрос, сохраняя контекст предыдущего диалога.
   *
   * Инвариант: I21 — ask intent в advising → loop (остаёмся в advising)
   *
   * Given:
   * - User: U1 с goal в Neo4j
   * - User уже в advising phase (задал первый вопрос)
   *
   * Flow:
   * - Setup: дойти до advising (turn 1-4)
   * - Turn 5: "какие навыки нужны?" → parse_advisor_intent(ask) → answer_question → advising
   *
   * Then:
   * - Turn 5: phase = advising (НЕ cancelled, НЕ showing_results)
   * - Turn 5: answerText отличается от первого ответа
   * - Turn 5: ответ релевантен новому вопросу
   *
   * Тип теста: Integration (multi-turn, real LLM)
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

    // Turn 1-3: Get to showing_results (new flow with asking_search_mode)
    await runGraph("покажи результаты");
    await runGraph("save");
    await runGraph("проводники");

    // Turn 4: First question → advising
    const turn4 = await runGraph("чем отличается первый кандидат от второго?");
    expect(turn4.phase).toBe(PHASE.advising);

    if (turn4.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    const firstAnswer = turn4.answerText;
    console.log(`TC-SG-ADV2 [1/2]: ✅ First question answered (${firstAnswer.length} chars)`);

    // Turn 5: Second question → stays in advising
    const turn5 = await runGraph("какие навыки мне нужно изучить?");
    expect(turn5.phase, "Follow-up question MUST stay in advising phase").toBe(PHASE.advising);

    if (turn5.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    expect(turn5.answerText, "Second answer MUST be provided").toBeTruthy();
    expect(turn5.answerText, "Second answer MUST be different from first").not.toBe(firstAnswer);

    console.log(`TC-SG-ADV2 [2/2]: ✅ Second question answered (${turn5.answerText.length} chars)`);
  }, 420_000);

  /**
   * TC-SG-ADV3: Выход из режима консультации через "done"
   *
   * Что тестируем:
   * Пользователь в режиме консультации говорит "готово" / "хватит" / "done".
   * parse_advisor_intent ДОЛЖЕН распознать intent=done и вернуться к результатам.
   * UX: "спасибо" after Q&A = done asking questions, returns to results (not cancel).
   *
   * Инвариант: I22 — done intent в advising → showing_results
   *
   * Given:
   * - User: U1 с goal в Neo4j
   * - User в advising phase (задал хотя бы один вопрос)
   *
   * Flow:
   * - Setup: дойти до advising (turn 1-4)
   * - Turn 5: "готово, хватит вопросов" → parse_advisor_intent(done) → showing_results
   *
   * Then:
   * - Turn 5: phase = showing_results (НЕ advising, НЕ cancelled)
   *
   * Тип теста: Integration (multi-turn, real LLM)
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

    // Get to advising phase (new flow with asking_search_mode)
    await runGraph("покажи результаты");
    await runGraph("save");
    await runGraph("проводники");
    const advising = await runGraph("расскажи про кандидатов");
    expect(advising.phase).toBe(PHASE.advising);

    console.log("TC-SG-ADV3 [1/2]: ✅ In advising phase");

    // Exit with "done" — returns to showing_pathfinder_results (since we used "проводники")
    // Use explicit "done" intent phrase to help LLM classify correctly
    const exit = await runGraph("готово, хватит вопросов");
    expect(exit.phase, "'Done' intent returns to results").toBe(PHASE.showing_pathfinder_results);

    console.log("TC-SG-ADV3 [2/2]: ✅ Returned to results after advisor done");
  }, 360_000);
});
