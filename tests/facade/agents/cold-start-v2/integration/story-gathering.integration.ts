import { beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: Story Gathering (TC-S)", () => {
  const testUserId: UserId = "usr_01933ec5-0001-0000-0000-000000000001";
  const threadId = `cold_start_v2_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    const checkpointer = ctx.checkpointService.getCheckpointer();
    return new ColdStartGraph(testUserId, checkpointer).run(
      message,
      threadId,
      ctx.coreClient,
      ctx.normalizer,
      ctx.userService,
    );
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
  });

  /**
   * TC-S1: Initial greeting → story_gathering phase
   *
   * Что тестируем:
   * Базовая работоспособность LangGraph. При любом сообщении граф
   * стартует в фазе story_gathering и отвечает.
   *
   * Given:
   * - Произвольное сообщение ("Hello")
   * - Нет предыдущего состояния (checkpoint чист)
   *
   * Then:
   * - Phase: story_gathering
   * - Граф отвечает без ошибок
   *
   * Тип теста: Integration (real LLM, но минимальный вызов)
   */
  it("TC-S1: Initial greeting → story_gathering phase", async () => {
    const message = "Hello";

    const response = await runWorkflow(message);

    expect(response.phase).toBe("story_gathering");
  });

  /**
   * TC-S2: Story accumulation (multiple messages)
   *
   * Что тестируем:
   * Граф остаётся в story_gathering при отправке нескольких сообщений подряд
   * без триггера завершения. История накапливается в checkpoint.
   *
   * Given:
   * - Отправляем 3 сообщения подряд без триггера завершения
   * - Каждое сообщение содержит часть карьерной истории
   *
   * Then:
   * - После каждого сообщения phase остаётся story_gathering
   * - Checkpoint содержит accumulatedStory (не пустой после 3 сообщений)
   * - LLM продолжает запрашивать информацию
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-S2: Story accumulation (multiple messages)", async () => {
    const ctx = FacadeTestContext.getInstance();

    const message1 = "Я работал джуном 2 года в стартапе в Берлине";
    const response1 = await runWorkflow(message1);
    expect(response1.phase, "After message 1, phase should be story_gathering").toBe(PHASE.story_gathering);
    if (response1.phase === PHASE.story_gathering) {
      expect(response1.message.length, "LLM should respond with non-empty message").toBeGreaterThan(0);
      console.log(`TC-S2 [1/3]: Message 1 → story_gathering, response length: ${response1.message.length}`);
    }

    const message2 = "Потом я стал мидлом и работал ещё 3 года";
    const response2 = await runWorkflow(message2);
    expect(response2.phase, "After message 2, phase should still be story_gathering").toBe(PHASE.story_gathering);
    if (response2.phase === PHASE.story_gathering) {
      console.log(`TC-S2 [2/3]: Message 2 → story_gathering, response length: ${response2.message.length}`);
    }

    const message3 = "Использовал React, TypeScript, Node.js";
    const response3 = await runWorkflow(message3);
    expect(response3.phase, "After message 3, phase should still be story_gathering").toBe(PHASE.story_gathering);
    console.log(`TC-S2 [3/3]: Message 3 → story_gathering`);

    const checkpointState = await ctx.checkpointService.getState(threadId);
    const { messages } = checkpointState ?? {};

    expect(messages, "Checkpoint should contain messages array").toBeDefined();
    expect(Array.isArray(messages), "messages should be an array").toBe(true);

    if (Array.isArray(messages)) {
      expect(
        messages.length,
        "messages should contain accumulated history (at least 3 messages)",
      ).toBeGreaterThanOrEqual(3);
      console.log(`TC-S2: ✅ Checkpoint contains ${messages.length} messages (accumulated history)`);
    }

    console.log("TC-S2: ✅ Story accumulation test passed — multiple messages stay in story_gathering");
  }, 60_000);

  /**
   * TC-S3: Story completion trigger detection
   *
   * Что тестируем:
   * LLM распознаёт explicit trigger завершения истории и граф переходит к планированию.
   * Короткая, но содержательная история (2 позиции + технологии + duration) + trigger
   * ДОЛЖНА привести к созданию плана с 2 contexts.
   *
   * Эмпирика: 100% стабильность (3/3 runs → awaiting_plan_confirmation, queue=2).
   *
   * Given:
   * - Story: "Junior 2 года → Middle 3 года" (2 позиции)
   * - Technologies: React, TypeScript (explicit)
   * - Duration: 2 года + 3 года (explicit)
   * - Trigger: "Готово, это вся моя карьерная история."
   *
   * Then:
   * - Phase: awaiting_plan_confirmation (STRICT)
   * - Queue: exactly 2 contexts (junior + middle)
   *
   * Note: Если тест падает:
   * 1. Проверить STORY_DECISION_PROMPT (trigger detection + sufficient detail)
   * 2. Проверить LLM model change
   * 3. Если queue != 2: проверить plan_career_history tool
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-S3: Story completion trigger detection", async () => {
    const shortStory = `
      Я работал джуном в Берлине 2 года, использовал React и TypeScript.
      Потом стал мидлом и работал ещё 3 года.
      ${STORY_COMPLETION_TRIGGER}
    `;

    const response = await runWorkflow(shortStory);

    // СТРОГАЯ ПРОВЕРКА: short but substantive story + explicit trigger MUST proceed to planning
    expect(
      response.phase,
      "Short but substantive story (2 positions + technologies + duration) + explicit trigger MUST proceed to planning. " +
        "If this fails, check: (1) STORY_DECISION_PROMPT trigger detection, (2) LLM model change",
    ).toBe(PHASE.awaiting_plan_confirmation);

    // Type guard для доступа к phase-specific properties
    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed after strict assertion");
    }

    // ТОЧНОЕ ОЖИДАНИЕ: история содержит 2 позиции (junior → middle)
    expect(response.queue.length, "Plan should contain exactly 2 contexts (junior + middle)").toBe(2);

    console.log(`TC-S3: ✅ Trigger detected → plan created with ${response.queue.length} context(s)`);
  }, 60_000);
});
