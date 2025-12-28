import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PHASE, UpdateContextGraph } from "../../../../../src/facade/langGraph/update-context/update-context-graph.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";

import type { UserContext, UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

async function cleanupUpdateContext(userId: UserId, threadId: string): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  await ctx.checkpointService.delete(threadId);
  await ctx.coreClient.client.story.deleteStory.mutate({ userId });
}

function createTestContext(contextId: string): UserContext {
  return {
    contextId,
    previousContextId: null,
    nextContextId: null,
    createdAt: new Date().toISOString(),
    creationReason: ["started_working"],
    position: "backend developer",
    role: "developer",
    industry: "fintech",
    skills: ["python", "postgresql"],
    domains: ["payments"],
    companySize: "medium",
    countryCode: "RU",
    cityName: "moscow",
    citizenships: ["RU"],
    birthYear: 1993,
    educationLevel: "BACHELOR",
    salaryExact: 200000,
    salaryMin: null,
    salaryMax: null,
    languages: ["ru", "en"],
    feedback: null,
  };
}

describe("Update-Context: Integration Tests (TC-UPD)", () => {
  const testUserId: UserId = "usr_01933ec5-0300-0000-0000-000000000300";
  const testContextId = "ctx_01933ec5-0300-0000-0000-000000000300";
  const threadId = `update_context_${testUserId}`;
  let testSessionId: SessionId;
  let currentContext: UserContext;

  const runWorkflow = (message: string): ReturnType<UpdateContextGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new UpdateContextGraph(ctx.getGraphDeps()).run(message, threadId, testUserId, currentContext, "en");
  };

  beforeEach(async () => {
    await cleanupUpdateContext(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);

    const facadeCtx = FacadeTestContext.getInstance();
    currentContext = createTestContext(testContextId);

    await facadeCtx.coreClient.client.context.upsertContext.mutate({
      userId: testUserId,
      context: currentContext,
    });

    testSessionId = await setupSession(testUserId);
    trackTestUser(testUserId);
  });

  afterAll(async () => {
    await cleanupSession(testSessionId);
    await cleanupAllTestUsers();
  });

  /**
   * TC-UPD-E1: Happy path — update salary
   *
   * Что тестируем:
   * Partial update существующего контекста (изменение зарплаты).
   *
   * Given:
   * - Существующий контекст с salaryExact=200000
   * - User: "Повысили зарплату до 300000"
   *
   * Then:
   * - phase: awaiting_confirmation → saved
   * - mergedContext.salaryExact: 300000
   * - остальные поля unchanged
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  it("TC-UPD-E1: Happy path — update salary", async () => {
    const updateRequest = "Повысили зарплату до 300000 рублей";

    console.log("TC-UPD-E1 [1/3]: Sending salary update → awaiting_confirmation");
    const extractionResponse = await runWorkflow(updateRequest);

    if (extractionResponse.phase === PHASE.failed) {
      console.log("TC-UPD-E1: Got failed:", extractionResponse.message);
      expect.fail(`Expected awaiting_confirmation, got failed: ${extractionResponse.message}`);
    }

    expect(extractionResponse.phase).toBe(PHASE.awaiting_confirmation);
    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`Unexpected phase: ${extractionResponse.phase}`);
    }

    const { before, after } = extractionResponse;
    console.log(`TC-UPD-E1 [1/3]: Before salary=${before.salaryExact}, After salary=${after.salaryExact}`);

    expect(before.salaryExact).toBe(200000);
    expect(after.salaryExact).toBe(300000);
    expect(after.position).toBe(before.position);
    expect(after.contextId).toBe(before.contextId);

    console.log("TC-UPD-E1 [2/3]: Confirming → saved");
    const savedResponse = await runWorkflow("да, всё верно");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got: ${savedResponse.phase}`);
    }

    console.log(`TC-UPD-E1 [2/3]: Saved, contextId=${savedResponse.updatedContext.contextId}`);

    console.log("TC-UPD-E1 [3/3]: Verifying Neo4j persistence");
    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });

    expect(storyInDb.contexts.length).toBe(1);
    const savedContext = storyInDb.contexts[0];
    expect(savedContext).toBeDefined();
    expect(savedContext?.salaryExact).toBe(300000);
    expect(savedContext?.position).toBe("backend developer");

    console.log("TC-UPD-E1 [3/3]: Context verified in Neo4j with updated salary");
  });

  /**
   * TC-UPD-M1: No updates extracted → failed
   *
   * Что тестируем:
   * Сообщение без данных для обновления приводит к failed.
   *
   * Given:
   * - Существующий контекст
   * - User: "Привет, как дела?"
   *
   * Then:
   * - phase: failed
   * - validationErrors includes "No updates extracted"
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UPD-M1: No updates extracted → failed", async () => {
    const noUpdateMessage = "Привет, как дела? Просто зашёл поздороваться.";

    console.log("TC-UPD-M1 [1/1]: Sending message without updates → failed");
    const response = await runWorkflow(noUpdateMessage);

    if (response.phase === PHASE.awaiting_confirmation) {
      console.log("TC-UPD-M1: LLM extracted updates anyway:");
      console.log("  before:", response.before.position, response.before.salaryExact);
      console.log("  after:", response.after.position, response.after.salaryExact);
      expect.fail("Expected failed but LLM extracted some updates");
    }

    expect(response.phase).toBe(PHASE.failed);
    if (response.phase !== PHASE.failed) {
      expect.fail(`Unexpected phase: ${response.phase}`);
    }

    console.log(`TC-UPD-M1 [1/1]: Failed as expected, message: ${response.message}`);
  });

  /**
   * TC-UPD-E2: Update multiple fields
   *
   * Что тестируем:
   * Обновление нескольких полей одновременно.
   *
   * Given:
   * - Существующий контекст
   * - User: "Теперь senior backend developer, зарплата 350000"
   *
   * Then:
   * - phase: awaiting_confirmation → saved
   * - position изменился
   * - salary изменился
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UPD-E2: Update multiple fields", async () => {
    const multiUpdateRequest = "Теперь я senior backend developer, зарплата 350000";

    console.log("TC-UPD-E2 [1/2]: Sending multi-field update → awaiting_confirmation");
    const extractionResponse = await runWorkflow(multiUpdateRequest);

    if (extractionResponse.phase === PHASE.failed) {
      console.log("TC-UPD-E2: Got failed:", extractionResponse.message);
      expect.fail(`Expected awaiting_confirmation, got failed: ${extractionResponse.message}`);
    }

    expect(extractionResponse.phase).toBe(PHASE.awaiting_confirmation);
    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`Unexpected phase: ${extractionResponse.phase}`);
    }

    const { before, after } = extractionResponse;
    console.log(`TC-UPD-E2 [1/2]: Position: "${before.position}" → "${after.position}"`);
    console.log(`TC-UPD-E2 [1/2]: Salary: ${before.salaryExact} → ${after.salaryExact}`);

    expect(after.position.toLowerCase()).toContain("senior");
    expect(after.position.toLowerCase()).toContain("backend");
    expect(after.salaryExact).toBe(350000);

    console.log("TC-UPD-E2 [2/2]: Confirming → saved");
    const savedResponse = await runWorkflow("да");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UPD-E2 [2/2]: Multi-field update saved");
  });

  /**
   * TC-UPD-DEC1: Cancel flow
   *
   * Что тестируем:
   * Пользователь может отменить обновление контекста.
   *
   * Given:
   * - Update extracted → awaiting_confirmation
   * - User: "отмена"
   *
   * Then:
   * - phase: cancelled
   * - context в Neo4j не изменён
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UPD-DEC1: Cancel flow", async () => {
    const updateRequest = "Зарплата теперь 250000";

    console.log("TC-UPD-DEC1 [1/2]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(updateRequest);

    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`TC-UPD-DEC1: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    console.log("TC-UPD-DEC1 [2/2]: Sending cancel → cancelled");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.cancelled);
    console.log("TC-UPD-DEC1 [2/2]: Workflow cancelled");

    const facadeCtx = FacadeTestContext.getInstance();
    const storyInDb = await facadeCtx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb.contexts[0]?.salaryExact).toBe(200000);
    console.log("TC-UPD-DEC1: Original salary preserved in Neo4j");
  });

  /**
   * TC-UPD-E3: Edit flow
   *
   * Что тестируем:
   * Пользователь может отредактировать извлечённые обновления.
   *
   * Given:
   * - Update extracted → awaiting_confirmation
   * - User: "нет, зарплата 280000"
   *
   * Then:
   * - phase остаётся awaiting_confirmation
   * - salary изменился на 280000
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-UPD-E3: Edit flow", async () => {
    const updateRequest = "Зарплата теперь 300000";

    console.log("TC-UPD-E3 [1/3]: Getting to awaiting_confirmation");
    const extractionResponse = await runWorkflow(updateRequest);

    if (extractionResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`TC-UPD-E3: Expected awaiting_confirmation, got ${extractionResponse.phase}`);
    }

    const originalSalary = extractionResponse.after.salaryExact;
    console.log(`TC-UPD-E3 [1/3]: Original extracted salary: ${originalSalary}`);

    console.log("TC-UPD-E3 [2/3]: Sending edit request");
    const editResponse = await runWorkflow("нет, зарплата 280000");

    expect(editResponse.phase).toBe(PHASE.awaiting_confirmation);
    if (editResponse.phase !== PHASE.awaiting_confirmation) {
      expect.fail(`Expected awaiting_confirmation after edit, got: ${editResponse.phase}`);
    }

    const newSalary = editResponse.after.salaryExact;
    console.log(`TC-UPD-E3 [2/3]: New salary after edit: ${newSalary}`);

    expect(newSalary).toBe(280000);

    console.log("TC-UPD-E3 [3/3]: Confirming edited update");
    const savedResponse = await runWorkflow("да");

    expect(savedResponse.phase).toBe(PHASE.saved);
    console.log("TC-UPD-E3 [3/3]: Edited update saved");
  });
});
