import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PHASE, UpsertTrailGraph } from "../../../../../src/facade/langGraph/upsert-trail/upsert-trail-graph.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

async function cleanupUpsertTrail(userId: UserId, threadId: string): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  await ctx.checkpointService.delete(threadId);
  await ctx.coreClient.client.story.deleteStory.mutate({ userId });
}

describe("Upsert-Trail: Integration Tests (TC-UT)", () => {
  const testUserId: UserId = "usr_01933ec5-0200-0000-0000-000000000200";
  const threadId = `upsert_trail_${testUserId}`;
  let testSessionId: SessionId;

  const runWorkflow = (message: string): ReturnType<UpsertTrailGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    const checkpointer = ctx.checkpointService.getCheckpointer();
    return new UpsertTrailGraph(testUserId, null, checkpointer).run(message, threadId, ctx.coreClient, ctx.normalizer);
  };

  beforeEach(async () => {
    await cleanupUpsertTrail(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);
    testSessionId = await setupSession(testUserId);
    trackTestUser(testUserId);
  });

  afterAll(async () => {
    await cleanupSession(testSessionId);
    await cleanupAllTestUsers();
  });

  /**
   * TC-UT-E1: Happy path — full trail → saved
   *
   * Что тестируем:
   * Полный trail из текста извлекается и сохраняется в Neo4j.
   *
   * Given:
   * - Текст с skill, platform, duration, cost, rating
   *
   * Then:
   * - phase: awaiting_confirmation → saved
   * - trail содержит извлечённые данные
   * - trail сохранён в Neo4j
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  it("TC-UT-E1: Happy path — full trail → saved", async () => {
    const fullTrailInput = `
Прошёл курс Python на Coursera, 8 недель, $49.
Занимался 3 раза в неделю по 2 часа.
Отличный курс, рекомендую. Оценка: 5/5.
    `.trim();

    console.log("TC-UT-E1 [1/3]: Sending full trail → awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullTrailInput);

    if (extractionResponse.phase === PHASE.awaitingClarification) {
      console.log("TC-UT-E1: Got clarification, missing:", extractionResponse.missingFields);
      expect.fail(
        `Expected awaiting_confirmation, got clarification for: ${JSON.stringify(extractionResponse.missingFields)}`,
      );
    }

    expect(extractionResponse.phase).toBe(PHASE.awaitingConfirmation);
    if (extractionResponse.phase !== PHASE.awaitingConfirmation) {
      expect.fail(`Unexpected phase: ${extractionResponse.phase}`);
    }

    const trail = extractionResponse.trail;
    console.log(`TC-UT-E1 [1/3]: Extracted: skill="${trail.skill}", platform="${trail.platform}"`);

    expect(trail.skill.toLowerCase()).toContain("python");
    expect(trail.platform.toLowerCase()).toContain("coursera");

    console.log("TC-UT-E1 [2/3]: Confirming → saved");
    const savedResponse = await runWorkflow("да, всё верно");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got: ${savedResponse.phase}`);
    }

    console.log(`TC-UT-E1 [2/3]: Saved, trailId=${savedResponse.trail.trailId}`);

    console.log("TC-UT-E1 [3/3]: Verifying Neo4j persistence");
    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });

    expect(storyInDb.trails.length).toBe(1);
    expect(storyInDb.trails[0]?.skill.toLowerCase()).toContain("python");
    expect(storyInDb.trails[0]?.platform.toLowerCase()).toContain("coursera");

    console.log("TC-UT-E1 [3/3]: Trail verified in Neo4j");
  });

  /**
   * TC-UT-E2: Minimal trail (skill + platform only) → saved
   *
   * Что тестируем:
   * Минимальный trail только с required полями сохраняется.
   *
   * Given:
   * - Только skill и platform
   *
   * Then:
   * - phase: awaiting_confirmation → saved
   * - trail.skill и trail.platform заполнены
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UT-E2: Minimal trail (skill + platform only) → saved", async () => {
    const minimalInput = "Учу React на YouTube";

    console.log("TC-UT-E2 [1/2]: Sending minimal trail → awaiting_confirmation");
    const extractionResponse = await runWorkflow(minimalInput);

    if (extractionResponse.phase === PHASE.awaitingClarification) {
      console.log("TC-UT-E2: Got clarification for:", extractionResponse.missingFields);
      expect.fail(
        `Expected awaiting_confirmation for minimal trail, got clarification: ${JSON.stringify(extractionResponse.missingFields)}`,
      );
    }

    expect(extractionResponse.phase).toBe(PHASE.awaitingConfirmation);
    if (extractionResponse.phase !== PHASE.awaitingConfirmation) {
      expect.fail(`Unexpected phase: ${extractionResponse.phase}`);
    }

    const trail = extractionResponse.trail;
    expect(trail.skill.toLowerCase()).toContain("react");
    expect(trail.platform.toLowerCase()).toContain("youtube");

    console.log(`TC-UT-E2 [1/2]: Extracted: skill="${trail.skill}", platform="${trail.platform}"`);

    console.log("TC-UT-E2 [2/2]: Confirming → saved");
    const savedResponse = await runWorkflow("да");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UT-E2 [2/2]: Minimal trail saved");
  });

  /**
   * TC-UT-CL1: Clarification trigger — missing skill
   *
   * Что тестируем:
   * Неполный trail без skill вызывает clarification.
   *
   * Given:
   * - Текст только с platform, без skill
   *
   * Then:
   * - phase: awaiting_clarification
   * - missingFields.length > 0
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UT-CL1: Clarification trigger — missing skill", async () => {
    const incompleteInput = "Прошёл курс на Coursera";

    console.log("TC-UT-CL1 [1/1]: Sending incomplete trail (no skill) → awaiting_clarification");
    const response = await runWorkflow(incompleteInput);

    if (response.phase === PHASE.awaitingConfirmation) {
      console.log("TC-UT-CL1: LLM filled all fields:");
      console.log("  skill:", response.trail.skill);
      console.log("  platform:", response.trail.platform);
      expect.fail(
        `Expected clarification but LLM filled skill="${response.trail.skill}", platform="${response.trail.platform}"`,
      );
    }

    expect(response.phase).toBe(PHASE.awaitingClarification);
    if (response.phase !== PHASE.awaitingClarification) {
      expect.fail(`Unexpected phase: ${response.phase}`);
    }

    expect(response.missingFields.length).toBeGreaterThan(0);
    console.log(
      `TC-UT-CL1 [1/1]: Clarification triggered, missingFields: ${response.missingFields.map((f) => f.field).join(", ")}`,
    );
  });

  /**
   * TC-UT-DEC1: Cancel flow
   *
   * Что тестируем:
   * Пользователь может отменить создание trail.
   *
   * Given:
   * - Полный trail → awaiting_confirmation
   * - User: "отмена"
   *
   * Then:
   * - phase: cancelled
   * - trail НЕ сохранён в Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UT-DEC1: Cancel flow", async () => {
    const fullTrailInput = `
Прошёл курс TypeScript на Udemy, 4 недели.
Неплохой курс.
    `.trim();

    console.log("TC-UT-DEC1 [1/2]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullTrailInput);

    if (extractionResponse.phase !== PHASE.awaitingConfirmation) {
      expect.fail(`TC-UT-DEC1: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    console.log("TC-UT-DEC1 [2/2]: Sending cancel → cancelled");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.cancelled);
    console.log("TC-UT-DEC1 [2/2]: Workflow cancelled");

    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb.trails.length).toBe(0);
  });

  /**
   * TC-UT-E3: Edit flow
   *
   * Что тестируем:
   * Пользователь может отредактировать извлечённый trail.
   *
   * Given:
   * - Trail извлечён → awaiting_confirmation
   * - User: "измени платформу на Udemy"
   *
   * Then:
   * - phase остаётся awaiting_confirmation
   * - platform изменился
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UT-E3: Edit flow", async () => {
    const fullTrailInput = `
Прошёл курс JavaScript на Coursera, 6 недель.
    `.trim();

    console.log("TC-UT-E3 [1/3]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(fullTrailInput);

    if (extractionResponse.phase !== PHASE.awaitingConfirmation) {
      expect.fail(`TC-UT-E3: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    const originalPlatform = extractionResponse.trail.platform;
    console.log(`TC-UT-E3 [1/3]: Original platform: "${originalPlatform}"`);

    console.log("TC-UT-E3 [2/3]: Sending edit request");
    const editResponse = await runWorkflow("измени платформу на Udemy");

    expect(editResponse.phase).toBe(PHASE.awaitingConfirmation);
    if (editResponse.phase !== PHASE.awaitingConfirmation) {
      expect.fail(`Expected awaiting_confirmation after edit, got: ${editResponse.phase}`);
    }

    const newPlatform = editResponse.trail.platform;
    console.log(`TC-UT-E3 [2/3]: New platform: "${newPlatform}"`);

    expect(newPlatform.toLowerCase()).toContain("udemy");

    console.log("TC-UT-E3 [3/3]: Confirming edited trail");
    const savedResponse = await runWorkflow("да");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UT-E3 [3/3]: Edited trail saved");
  });
});
