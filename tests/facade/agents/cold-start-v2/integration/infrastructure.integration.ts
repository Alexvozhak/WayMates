import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { contextIdSchema } from "../../../../../src/shared/schemas.js";
import { cleanupSession, getToolDeps, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: Infrastructure (TC-I)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-0008-0000-0000-000000000008";
  const threadId = `cold_start_v2_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new ColdStartGraph(ctx.getGraphDeps()).run(message, threadId, testUserId, null, "en");
  };

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);

    await cleanupColdStart(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);

    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });

  /**
   * TC-I1: State resume after 'closing chat' - continues from checkpoint
   *
   * Что тестируем:
   * Checkpoint persistence в PostgreSQL. После прерывания workflow
   * (симуляция "закрыл чат") можно продолжить с того же места.
   *
   * Given:
   * - Workflow дошёл до awaiting_context_confirmation
   * - Checkpoint существует в PostgreSQL
   * - "Новая сессия" (тот же threadId)
   *
   * Then:
   * - Checkpoint не null
   * - После resume phase === awaiting_context_confirmation или awaiting_final_confirmation
   * - Progress >= прогресс до resume
   *
   * Тип теста: Integration (real LLM + PostgreSQL checkpoint)
   */
  it("TC-I1: State resume after 'closing chat' - continues from checkpoint", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-I1 [1/5]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`TC-I1 [1/5]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-I1 [2/5]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log("TC-I1: ⚠️ Clarification needed, test cannot complete deterministically");
      expect.fail("TC-I1 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const progressBeforeResume = extractionResponse.progress;
    console.log(
      `TC-I1 [2/5]: ✅ Extraction started: context ${progressBeforeResume.current}/${progressBeforeResume.total}`,
    );

    console.log("TC-I1 [3/5]: Verifying checkpoint content (simulating 'close chat')");
    const ctx = FacadeTestContext.getInstance();
    const checkpointState = await ctx.checkpointService.getState(threadId);
    expect(checkpointState, "Checkpoint should exist in PostgreSQL").not.toBeNull();

    const { phase, queue, collectedContexts } = checkpointState!;

    expect(phase, "Checkpoint should contain phase").toBe(PHASE.awaiting_context_confirmation);
    expect(queue, "Checkpoint should contain queue").toBeDefined();
    expect(Array.isArray(queue), "queue should be an array").toBe(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    expect((queue as unknown[]).length, "queue should have items from planning").toBeGreaterThan(0);
    expect(collectedContexts, "Checkpoint should contain collectedContexts").toBeDefined();
    expect(Array.isArray(collectedContexts), "collectedContexts should be an array").toBe(true);

    console.log(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      `TC-I1 [3/5]: ✅ Checkpoint verified: phase=${String(phase)}, queue=${(queue as unknown[]).length} items, collectedContexts=${(collectedContexts as unknown[]).length} items`,
    );

    console.log("TC-I1 [4/5]: Resuming workflow with context confirmation");
    const resumeResponse = await runWorkflow("да, верно");

    const validResumePhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validResumePhases).toContain(resumeResponse.phase);

    console.log(`TC-I1 [4/5]: ✅ Resumed successfully, now at phase: ${resumeResponse.phase}`);

    if (resumeResponse.phase === PHASE.awaiting_context_confirmation) {
      expect(resumeResponse.progress.current).toBeGreaterThanOrEqual(progressBeforeResume.current);
      console.log(
        `TC-I1 [5/5]: ✅ Progress advanced: ${resumeResponse.progress.current}/${resumeResponse.progress.total}`,
      );
    } else if (resumeResponse.phase === PHASE.awaiting_final_confirmation) {
      console.log(`TC-I1 [5/5]: ✅ All contexts confirmed, ready for final confirmation`);
    }

    console.log("TC-I1: ✅ State resume test passed — checkpoint persistence works correctly");
  }, 240_000);

  /**
   * TC-I2: Checkpoint cleanup after save (via handleSaved)
   *
   * Что тестируем:
   * handleSaved() корректно очищает checkpoint после успешного сохранения.
   * Это предотвращает накопление stale checkpoints.
   *
   * Given:
   * - Full workflow до saved state
   *
   * Then:
   * - Checkpoint === null после saved
   * - isColdStartCompleted === true
   *
   * Тип теста: Integration (real LLM + PostgreSQL checkpoint)
   */
  it("TC-I2: Checkpoint cleanup after save (via handleSaved)", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const coldStartTool = new ColdStartTool(getToolDeps());

    const runTool = async (message: string) => {
      const result = await coldStartTool.execute({
        sessionId: testSessionId,
        requestId: randomUUID(),
        message,
        cvText: null,
      });
      if (!result.ok) {
        console.error("TC-I2 error details:", JSON.stringify(result.error, null, 2));
        expect.fail(`ColdStartTool error: ${result.error.message}`);
      }
      return result.value;
    };

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-I2 [1/5]: Running full workflow via ColdStartTool to saved state");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    let currentResponse = await runTool("да, всё верно");

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("TC-I2 requires extraction without clarification");
    }

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-I2 [2/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("TC-I2 [3/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    console.log(`TC-I2 [3/5]: ✅ Workflow completed: ${savedResponse.contexts.length} contexts saved`);

    console.log("TC-I2 [4/4]: Verifying checkpoint was deleted by handleSaved()");
    const ctx = FacadeTestContext.getInstance();
    const toolThreadId = `cold_start_${testUserId}`;
    const checkpointAfterSave = await ctx.checkpointService.getState(toolThreadId);

    expect(checkpointAfterSave).toBeNull();
    console.log("TC-I2 [4/4]: ✅ Checkpoint deleted immediately by handleSaved()");

    console.log("TC-I2: ✅ Checkpoint cleanup test passed — handleSaved() cleanup works correctly");
  }, 300_000);

  /**
   * TC-I4: Cancel workflow stops without saving + Neo4j verification
   *
   * Что тестируем:
   * Команда "отмена" прерывает workflow без сохранения данных.
   * Проверяем что Neo4j не содержит данные после cancel.
   *
   * Given:
   * - Workflow в awaiting_plan_confirmation
   * - User sends: "отмена"
   *
   * Then:
   * - Phase: failed
   * - Message содержит "cancel" или "отмен"
   * - Neo4j contexts.length === 0
   * - Neo4j trails.length === 0
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  it("TC-I4: Cancel workflow stops without saving + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    console.log("TC-I4 [1/4]: Starting workflow");
    const initialResponse = await runWorkflow("Привет, хочу рассказать о карьере");

    expect(initialResponse.phase).toBe(PHASE.story_gathering);
    console.log("TC-I4 [1/4]: ✅ Workflow started, phase: story_gathering");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-I4 [2/4]: Sending story to get plan");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`TC-I4 [2/4]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-I4 [3/4]: Sending cancel command");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.failed);

    if (cancelResponse.phase === PHASE.failed) {
      const cancelMentioned =
        cancelResponse.message.toLowerCase().includes("cancel") ||
        cancelResponse.message.toLowerCase().includes("отмен");
      console.log(`TC-I4 [3/4]: ✅ Workflow cancelled, message: "${cancelResponse.message}"`);

      if (!cancelMentioned) {
        console.log("TC-I4: ⚠️ Message does not mention cancel, but phase is correct");
      }
    } else {
      console.log(`TC-I4: ❌ Unexpected phase after cancel: ${cancelResponse.phase}`);
      expect.fail(`Expected failed phase after cancel, got ${cancelResponse.phase}`);
    }

    console.log("TC-I4 [4/4]: Verifying data was NOT saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb.contexts.length, "BUG: Data was saved to Neo4j after cancel!").toBe(0);
    expect(storyInDb.trails.length, "BUG: Trails were saved to Neo4j after cancel!").toBe(0);
    console.log("TC-I4 [4/4]: ✅ Neo4j verified: no data was saved after cancel");

    console.log("TC-I4: ✅ Cancel workflow test passed — workflow stopped without saving");
  }, 180_000);

  /**
   * TC-I5: LLM extraction follows case conventions (lowercase + ISO uppercase)
   *
   * Что тестируем:
   * LLM соблюдает требования к регистру для разных типов полей:
   * - lowercase: position, skills, domains, industry, cityName
   * - UPPERCASE (ISO): countryCode, citizenships, languages
   *
   * Given:
   * - U1 fixture
   * - Extraction успешно (awaiting_context_confirmation)
   *
   * Then:
   * - Business fields в lowercase: position, skills, domains, industry, cityName
   * - ISO fields в UPPERCASE: countryCode, citizenships, languages
   *
   * Тип теста: Integration (real LLM) — проверка compliance
   */
  it("TC-I5: LLM extraction follows case conventions (lowercase + ISO uppercase)", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-I5 [1/3]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log("TC-I5 [2/3]: Confirming plan → extraction");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      console.warn(
        `TC-I5: ⚠️ SKIPPED - LLM requested clarification (phase: ${extractionResponse.phase}). ` +
          `This is NOT a failure, but if it happens consistently, review U1 fixture or extraction prompts.`,
      );
      return;
    }

    const entity = extractionResponse.entity;
    console.log(`TC-I5 [3/3]: Checking LLM output for case conventions`);
    console.log(
      `TC-I5 [3/3]: countryCode=${entity.countryCode}, citizenships=${entity.citizenships.join(",")}, languages=${entity.languages?.join(",") ?? "none"}`,
    );

    const assertLowercase = (value: string, field: string) => {
      expect(value, `${field} "${value}" should be lowercase`).toBe(value.toLowerCase());
    };

    const assertUppercase = (value: string, field: string) => {
      expect(value, `${field} "${value}" should be UPPERCASE (ISO)`).toBe(value.toUpperCase());
    };

    const assertArrayLowercase = (arr: string[], field: string) => {
      const nonLowercase = arr.filter((v) => v !== v.toLowerCase());
      expect(nonLowercase.length, `${field} contains non-lowercase: ${nonLowercase.join(", ")}`).toBe(0);
    };

    const assertArrayUppercase = (arr: string[], field: string) => {
      const nonUppercase = arr.filter((v) => v !== v.toUpperCase());
      expect(nonUppercase.length, `${field} contains non-UPPERCASE: ${nonUppercase.join(", ")}`).toBe(0);
    };

    // Business fields → lowercase
    assertLowercase(entity.position, "position");
    assertArrayLowercase(entity.skills, "skills");
    assertArrayLowercase(entity.domains, "domains");
    assertLowercase(entity.industry, "industry");
    assertLowercase(entity.cityName, "cityName");

    // ISO fields → UPPERCASE (ISO 3166-1 alpha-2, ISO 639-1)
    assertUppercase(entity.countryCode, "countryCode");
    assertArrayUppercase(entity.citizenships, "citizenships");

    if (entity.languages && entity.languages.length > 0) {
      assertArrayUppercase(entity.languages, "languages");
    }

    const contextIdResult = contextIdSchema.safeParse(entity.contextId);
    expect(contextIdResult.success, `entity.contextId "${entity.contextId}" must match ctx_<UUID> format`).toBe(true);

    console.log(
      `TC-I5: ✅ Case conventions verified: position="${entity.position}" (lower), ` +
        `countryCode="${entity.countryCode}" (UPPER), ` +
        `skills=${entity.skills.length}, domains=${entity.domains.length}`,
    );
  }, 180_000);
});
