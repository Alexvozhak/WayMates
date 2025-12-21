import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PHASE, UpsertContextGraph } from "../../../../../src/facade/langGraph/upsert-context/upsert-context-graph.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

async function cleanupUpsertContext(userId: UserId, threadId: string): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  await ctx.checkpointService.delete(threadId);
  await ctx.coreClient.client.story.deleteStory.mutate({ userId });
}

describe("Upsert-Context: Integration Tests (TC-UC)", () => {
  const testUserId: UserId = "usr_01933ec5-0100-0000-0000-000000000100";
  const threadId = `upsert_context_${testUserId}`;
  let testSessionId: SessionId;

  const runWorkflow = (message: string): ReturnType<UpsertContextGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new UpsertContextGraph(ctx.getGraphDeps()).run(message, threadId, testUserId);
  };

  beforeEach(async () => {
    await cleanupUpsertContext(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);
    testSessionId = await setupSession(testUserId);
    trackTestUser(testUserId);
  });

  afterAll(async () => {
    await cleanupSession(testSessionId);
    await cleanupAllTestUsers();
  });

  /**
   * TC-UC-E1: Happy path — full context → saved
   *
   * Что тестируем:
   * Полный контекст из текста извлекается и сохраняется в Neo4j.
   *
   * Given:
   * - Текст с position, industry, skills, domains, location
   *
   * Then:
   * - phase: awaiting_confirmation → saved
   * - context содержит извлечённые данные
   * - context сохранён в Neo4j
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  it("TC-UC-E1: Happy path — full context → saved", async () => {
    const fullContextInput = `
Я работаю senior backend developer в fintech компании в Москве с марта 2023.
Стек: Python, PostgreSQL, Redis.
Домены: backend, payments, api-development.
Компания средняя (100-500 человек).
Мне 30 лет, гражданство РФ.
    `.trim();

    console.log("TC-UC-E1 [1/3]: Sending full context → awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullContextInput);

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log("TC-UC-E1: Got clarification, missing:", extractionResponse.missingFields);
      expect.fail(
        `Expected awaiting_confirmation, got clarification for: ${JSON.stringify(extractionResponse.missingFields)}`,
      );
    }

    expect(extractionResponse.phase).toBe(PHASE.awaiting_confirmation);
    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`Unexpected phase: ${extractionResponse.phase}`);
    }

    const ctx = extractionResponse.context;
    console.log(
      `TC-UC-E1 [1/3]: ✅ Extracted: position="${ctx.position}", role="${ctx.role}", industry="${ctx.industry}", domains=${JSON.stringify(ctx.domains)}`,
    );

    // Input: "senior backend developer в fintech"
    // position = seniority (senior), role = profession (developer), industry = fintech, domains = [backend, ...]
    expect(ctx.position).toContain("senior");
    expect(ctx.role).toBe("developer");
    expect(ctx.industry).toContain("fintech");
    expect(ctx.domains.some((d) => d.includes("backend"))).toBe(true);
    expect(ctx.skills.length).toBeGreaterThan(0);

    console.log("TC-UC-E1 [2/3]: Confirming → saved");
    const savedResponse = await runWorkflow("да, всё верно");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got: ${savedResponse.phase}`);
    }

    console.log(`TC-UC-E1 [2/3]: ✅ Saved, contextId=${savedResponse.context.contextId}`);

    console.log("TC-UC-E1 [3/3]: Verifying Neo4j persistence");
    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });

    expect(storyInDb.contexts.length).toBeGreaterThan(0);
    const savedCtx = storyInDb.contexts.find((c) => c.contextId === savedResponse.context.contextId);
    expect(savedCtx).toBeDefined();

    console.log("TC-UC-E1 [3/3]: ✅ Context verified in Neo4j");
  });

  /**
   * TC-UC-CL1: Clarification trigger — incomplete data
   *
   * Что тестируем:
   * Неполный контекст вызывает clarification (какое-то поле missing).
   *
   * Given:
   * - Минимальный текст без обязательных полей
   *
   * Then:
   * - phase: awaiting_clarification
   * - missingFields.length > 0
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UC-CL1: Clarification trigger — incomplete data", async () => {
    const incompleteInput = "Работаю программистом";

    console.log("TC-UC-CL1 [1/1]: Sending minimal context → awaiting_clarification");
    const response = await runWorkflow(incompleteInput);

    if (response.phase === PHASE.awaiting_confirmation) {
      console.log("TC-UC-CL1: LLM filled all fields, context:", response.context.position);
      expect.fail("Expected clarification but LLM filled all required fields");
    }

    expect(response.phase).toBe(PHASE.awaiting_clarification);
    if (response.phase !== PHASE.awaiting_clarification) {
      expect.fail(`Unexpected phase: ${response.phase}`);
    }

    expect(response.missingFields.length).toBeGreaterThan(0);
    console.log(
      `TC-UC-CL1 [1/1]: ✅ Clarification triggered, missingFields: ${response.missingFields.map((f) => f.field).join(", ")}`,
    );
  });

  /**
   * TC-UC-DEC1: Cancel flow
   *
   * Что тестируем:
   * Пользователь может отменить создание контекста.
   *
   * Given:
   * - Полный контекст → awaiting_confirmation
   * - User: "отмена"
   *
   * Then:
   * - phase: cancelled
   * - context НЕ сохранён в Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UC-DEC1: Cancel flow", async () => {
    const fullContextInput = `
Senior frontend developer в e-commerce, Берлин, TypeScript, React.
Работаю с 2022 года в крупной компании (enterprise).
Мне 28 лет, гражданство Германии.
    `.trim();

    console.log("TC-UC-DEC1 [1/2]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullContextInput);

    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`TC-UC-DEC1: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    console.log("TC-UC-DEC1 [2/2]: Sending cancel → cancelled");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.cancelled);
    console.log("TC-UC-DEC1 [2/2]: ✅ Workflow cancelled");

    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb.contexts.length).toBe(0);
  });

  /**
   * TC-UC-DEC3: Russian approve variants
   *
   * Что тестируем:
   * Система распознаёт разные варианты подтверждения на русском.
   *
   * Given:
   * - Полный контекст → awaiting_confirmation
   * - User: "норм" / "пойдёт" / "сохрани"
   *
   * Then:
   * - phase: saved (для любого варианта)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UC-DEC3: Russian approve variants", async () => {
    const fullContextInput = `
Data engineer в стартапе, Санкт-Петербург с февраля 2023.
Python, Spark, Airflow. Домен: data-engineering.
Компания маленькая (до 50 человек). Отрасль: tech.
Мне 32 года, гражданство РФ.
    `.trim();

    console.log("TC-UC-DEC3 [1/2]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullContextInput);

    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`TC-UC-DEC3: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    console.log("TC-UC-DEC3 [2/2]: Testing approve variant 'норм'");
    const savedResponse = await runWorkflow("норм");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UC-DEC3 [2/2]: ✅ 'норм' recognized as approve");
  });

  /**
   * TC-UC-E3: Edit flow
   *
   * Что тестируем:
   * Пользователь может отредактировать извлечённый контекст.
   *
   * Given:
   * - Контекст извлечён → awaiting_confirmation
   * - User: "измени позицию на lead"
   *
   * Then:
   * - phase остаётся awaiting_confirmation
   * - position изменился
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UC-E3: Edit flow", async () => {
    const fullContextInput = `
Backend developer в fintech, Москва, Python, FastAPI.
Работаю с января 2024, компания средняя.
Мне 29 лет, гражданство РФ.
    `.trim();

    console.log("TC-UC-E3 [1/3]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullContextInput);

    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`TC-UC-E3: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    const originalPosition = extractionResponse.context.position;
    console.log(`TC-UC-E3 [1/3]: ✅ Original position: "${originalPosition}"`);

    console.log("TC-UC-E3 [2/3]: Sending edit request");
    const editResponse = await runWorkflow("измени позицию на lead backend developer");

    expect(editResponse.phase).toBe(PHASE.awaiting_confirmation);
    if (editResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`Expected awaiting_confirmation after edit, got: ${editResponse.phase}`);
    }

    const newPosition = editResponse.context.position;
    console.log(`TC-UC-E3 [2/3]: ✅ New position: "${newPosition}"`);

    expect(newPosition.toLowerCase()).toContain("lead");

    console.log("TC-UC-E3 [3/3]: Confirming edited context");
    const savedResponse = await runWorkflow("да");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UC-E3 [3/3]: ✅ Edited context saved");
  });
});
