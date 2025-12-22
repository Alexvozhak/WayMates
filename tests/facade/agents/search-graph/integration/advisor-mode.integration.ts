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
   * - Turn 2: "save" → set_goal → search → showing_results
   * - Turn 3: "расскажи про первого" → parse_search_intent(ask) → answer_question → advising
   *
   * Then:
   * - Turn 3: phase = advising (НЕ showing_results, НЕ clarify_intent)
   * - Turn 3: answerText непустой и содержательный (>50 символов)
   * - Turn 3: options содержит "ask more" и "done"
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
    console.log("TC-SG-ADV1 [1/3]: ✅ Goal shown");

    // Turn 2: Save goal → showing_results
    const turn2 = await runGraph("save");
    expect(turn2.phase).toBe(PHASE.showing_results);

    if (turn2.phase !== PHASE.showing_results) {
      expect.fail("Type guard failed");
    }

    const resultsCount = turn2.results.length;
    console.log(`TC-SG-ADV1 [2/3]: ✅ Search results (${resultsCount} candidates)`);

    // Turn 3: Ask question → advising
    const turn3 = await runGraph("расскажи подробнее про первого кандидата");

    expect(turn3.phase, "Question intent MUST transition to advising phase").toBe(PHASE.advising);

    if (turn3.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    expect(turn3.answerText, "Advisor MUST provide non-empty answer").toBeTruthy();
    expect(turn3.answerText.length, "Answer should be substantial (>50 chars)").toBeGreaterThan(50);
    expect(turn3.options, "Options MUST include advisor actions").toContain("ask more");
    expect(turn3.options).toContain("done");

    console.log(`TC-SG-ADV1 [3/3]: ✅ Advisor mode activated`);
    console.log(`  Answer length: ${turn3.answerText.length} chars`);
    console.log(`  Answer preview: ${turn3.answerText.slice(0, 100)}...`);
  }, 300_000);

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
   * - Setup: дойти до advising (turn 1-3)
   * - Turn 4: "какие навыки нужны?" → parse_advisor_intent(ask) → answer_question → advising
   *
   * Then:
   * - Turn 4: phase = advising (НЕ cancelled, НЕ showing_results)
   * - Turn 4: answerText отличается от первого ответа
   * - Turn 4: ответ релевантен новому вопросу
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

    // Turn 1-2: Get to showing_results
    await runGraph("покажи результаты");
    await runGraph("save");

    // Turn 3: First question → advising
    const turn3 = await runGraph("чем отличается первый кандидат от второго?");
    expect(turn3.phase).toBe(PHASE.advising);

    if (turn3.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    const firstAnswer = turn3.answerText;
    console.log(`TC-SG-ADV2 [1/2]: ✅ First question answered (${firstAnswer.length} chars)`);

    // Turn 4: Second question → stays in advising
    const turn4 = await runGraph("какие навыки мне нужно изучить?");
    expect(turn4.phase, "Follow-up question MUST stay in advising phase").toBe(PHASE.advising);

    if (turn4.phase !== PHASE.advising) {
      expect.fail("Type guard failed");
    }

    expect(turn4.answerText, "Second answer MUST be provided").toBeTruthy();
    expect(turn4.answerText, "Second answer MUST be different from first").not.toBe(firstAnswer);

    console.log(`TC-SG-ADV2 [2/2]: ✅ Second question answered (${turn4.answerText.length} chars)`);
  }, 360_000);

  /**
   * TC-SG-ADV3: Выход из режима консультации через "done"
   *
   * Что тестируем:
   * Пользователь в режиме консультации говорит "спасибо" / "всё понятно" / "done".
   * parse_advisor_intent ДОЛЖЕН распознать intent=done и завершить сессию (cancelled).
   * Это терминальное состояние — граф завершает работу.
   *
   * Инвариант: I22 — done intent в advising → cancelled (терминальная фаза)
   *
   * Given:
   * - User: U1 с goal в Neo4j
   * - User в advising phase (задал хотя бы один вопрос)
   *
   * Flow:
   * - Setup: дойти до advising (turn 1-3)
   * - Turn 4: "спасибо, всё понятно" → parse_advisor_intent(done) → cancel → cancelled
   *
   * Then:
   * - Turn 4: phase = cancelled (НЕ advising, НЕ showing_results)
   * - Сессия завершена, checkpoint может быть удалён
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

    // Get to advising phase
    await runGraph("покажи результаты");
    await runGraph("save");
    const advising = await runGraph("расскажи про кандидатов");
    expect(advising.phase).toBe(PHASE.advising);

    console.log("TC-SG-ADV3 [1/2]: ✅ In advising phase");

    // Exit with "done"
    const exit = await runGraph("спасибо, всё понятно");
    expect(exit.phase, "'Done' intent MUST exit to cancelled phase").toBe(PHASE.cancelled);

    console.log("TC-SG-ADV3 [2/2]: ✅ Exited advisor mode");
  }, 300_000);
});
