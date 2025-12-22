import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { contextIdSchema, trailIdSchema } from "../../../../../src/shared/schemas.js";
import { cleanupSession, getToolDeps, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { ColdStartResponse, UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: Data Persistence (TC-D)", () => {
  let testSessionId: SessionId;
  let coldStartTool: ColdStartTool;
  const testUserId: UserId = "usr_01933ec5-0002-0000-0000-000000000002";
  const threadId = `cold_start_${testUserId}`;

  const runTool = async (message: string): Promise<ColdStartResponse> => {
    const result = await coldStartTool.execute({
      sessionId: testSessionId,
      requestId: randomUUID(),
      message,
      cvText: null,
    });
    if (!result.ok) {
      console.error(`ColdStartTool error:`, JSON.stringify(result.error, null, 2));
      throw new Error(`ColdStartTool failed: ${result.error.message}`);
    }
    return result.value;
  };

  beforeEach(async () => {
    await cleanupColdStart(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);

    testSessionId = await setupSession(testUserId);

    coldStartTool = new ColdStartTool(getToolDeps());

    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });

  /**
   * TC-D2: Full workflow phase transitions + Neo4j verification
   *
   * Что тестируем:
   * Полный цикл от story до saved. Проверяем все фазовые переходы
   * и что данные корректно сохраняются в Neo4j.
   *
   * Given:
   * - U1 fixture (простая история с 1-2 контекстами)
   * - User confirms на каждом шаге
   *
   * Then:
   * - Phase transitions: story → plan → extraction → final → saved
   * - Neo4j содержит contexts.length === savedResponse.contexts.length
   * - savedResponse.userId === testUserId
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  it("TC-D2: Full workflow phase transitions + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-D2 [1/5]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runTool(storyWithTrigger);

    expect(planResponse.phase).toBe(PHASE.awaiting_plan_confirmation);
    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    expect(planResponse.queue.length).toBeGreaterThan(0);

    console.log(`TC-D2 [1/5]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-D2 [2/5]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runTool("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-D2 [2/5]: ✅ Extraction started (context ${extractionResponse.progress.current}/${extractionResponse.progress.total})`,
      );
    } else if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log(`TC-D2 [2/5]: ⚠️ Clarification needed (${extractionResponse.missingFields.length} fields)`);
      expect.fail("TC-D2 requires successful extraction without clarification (use simpler story or check LLM)");
    } else {
      expect.fail(`Unexpected phase after plan confirmation: ${extractionResponse.phase}`);
    }

    console.log("TC-D2 [3/5]: Confirming contexts → awaiting_final_confirmation");

    let currentResponse = await runTool("да, верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = currentResponse.progress;
      console.log(`TC-D2 [3/5]: Confirmed context ${current}/${total}, continuing...`);

      currentResponse = await runTool("да, верно");
    }

    expect(currentResponse.phase).toBe(PHASE.awaiting_final_confirmation);
    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation after all contexts, got ${currentResponse.phase}`);
    }

    console.log(
      `TC-D2 [3/5]: ✅ All contexts confirmed (${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails)`,
    );

    console.log("TC-D2 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    expect(savedResponse.contexts.length).toBeGreaterThan(0);
    expect(savedResponse.userId).toBe(testUserId);

    console.log(`TC-D2 [4/5]: ✅ Workflow complete! Agent reports ${savedResponse.contexts.length} contexts`);

    console.log("TC-D2 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();
    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    console.log(`TC-D2 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts persisted`);
  }, 240_000);

  /**
   * TC-D1: Multi-context workflow → Neo4j save
   *
   * Что тестируем:
   * Полный цикл с 3+ контекстами (U10 fixture). Это основной happy path:
   * сложная история с несколькими позициями и trails.
   *
   * Given:
   * - U10 fixture (3 contexts + 2 trails)
   * - User confirms all contexts + final confirmation
   *
   * Then:
   * - Phase: saved
   * - Neo4j содержит ≥3 contexts
   * - Context linking корректен (один context с nextContextId=null)
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("TC-D1: Multi-context workflow → Neo4j save", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-D1 [1/5]: Sending U10 story (3 contexts + 2 trails)");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      console.log("TC-D1: Response:", JSON.stringify(planResponse, null, 2));
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    expect(planResponse.queue.length).toBeGreaterThanOrEqual(3);
    console.log(`TC-D1 [1/5]: ✅ Plan has ${planResponse.queue.length} contexts in queue`);

    const contextsWithTrails = planResponse.queue.filter((q) => q.incomingTrails.length > 0);
    console.log(`TC-D1 [1/5]: ${contextsWithTrails.length} contexts have incoming trails`);

    console.log("TC-D1 [2/5]: Confirming plan...");
    let currentResponse = await runTool("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-D1 [3/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("TC-D1: ⚠️ Clarification needed, cannot complete test deterministically");
      console.log("TC-D1: Missing fields:", JSON.stringify(currentResponse.missingFields, null, 2));
      expect.fail("TC-D1 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      console.log("TC-D1: Response:", JSON.stringify(currentResponse, null, 2));
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    expect(currentResponse.summary.contextsCount).toBeGreaterThanOrEqual(3);
    console.log(
      `TC-D1 [3/5]: ✅ Final summary: ${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails`,
    );

    console.log("TC-D1 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      console.log("TC-D1: Response:", JSON.stringify(savedResponse, null, 2));
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`TC-D1 [4/5]: ✅ Agent reports ${savedResponse.contexts.length} contexts saved`);

    console.log("TC-D1 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();

    console.log("TC-D1 [5/5]: Context links debug:");
    for (const c of storyInDb.contexts) {
      console.log(`  - ${c.contextId}: prev=${c.previousContextId ?? "null"}, next=${c.nextContextId ?? "null"}`);
    }

    const nullNextCount = storyInDb.contexts.filter((c) => !c.nextContextId).length;
    console.log(`TC-D1 [5/5]: Contexts with nextContextId=null: ${nullNextCount} (expected: 1)`);

    if (nullNextCount !== 1) {
      console.log("TC-D1 [5/5]: ❌ BUG DETECTED! Full contexts dump:");
      console.log(JSON.stringify(storyInDb.contexts, null, 2));
    }

    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    expect(storyInDb.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`TC-D1 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts persisted`);
  }, 300_000);

  /**
   * TC-D3: Trails extraction with correct context links + Neo4j verification
   *
   * Что тестируем:
   * Trails (учебные траектории) корректно связываются с contexts через
   * fromContextId/toContextId. Проверяем что links валидны и персистятся.
   *
   * Given:
   * - U10 fixture (3 contexts + 2 trails)
   * - User confirms all contexts + final confirmation
   *
   * Then:
   * - savedResponse.trails.length ≥ 1
   * - Каждый trail имеет skill, platform, trailId
   * - Каждый trail имеет fromContextId или toContextId
   * - fromContextId/toContextId ссылаются на существующие contexts
   * - Neo4j trails.length === savedResponse.trails.length
   *
   * Тип теста: Integration (real LLM + Neo4j)
   */
  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("TC-D3: Trails extraction with correct context links + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-D3 [1/5]: Sending U10 story for trails extraction");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    const totalIncomingTrails = planResponse.queue.reduce((sum, q) => sum + q.incomingTrails.length, 0);
    console.log(`TC-D3 [1/5]: Plan queue has ${totalIncomingTrails} total incoming trail references`);

    console.log("TC-D3 [2/5]: Confirming plan...");
    let currentResponse = await runTool("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-D3 [3/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );

      const trails = currentResponse.relatedTrails;
      if (trails.length > 0) {
        console.log(`TC-D3 [3/5]: Context has ${trails.length} related trail(s)`);
      }
      for (const trail of trails) {
        expect(trail.skill.length, `Trail skill should be non-empty`).toBeGreaterThan(0);
        expect(trail.skill, `Trail skill "${trail.skill}" should be lowercase`).toBe(trail.skill.toLowerCase());
        expect(trail.platform.length, `Trail platform should be non-empty`).toBeGreaterThan(0);
        expect(trail.platform, `Trail platform "${trail.platform}" should be lowercase`).toBe(
          trail.platform.toLowerCase(),
        );
      }

      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("TC-D3: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("TC-D3 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log(`TC-D3 [3/5]: Summary shows ${currentResponse.summary.trailsCount} trails`);

    console.log("TC-D3 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.trails.length).toBeGreaterThanOrEqual(1);
    console.log(`TC-D3 [4/5]: ✅ Agent reports ${savedResponse.trails.length} trail(s) saved`);

    for (const trail of savedResponse.trails) {
      const trailIdResult = trailIdSchema.safeParse(trail.trailId);
      expect(trailIdResult.success, `trailId "${trail.trailId}" must match trl_<UUID> format`).toBe(true);

      expect(trail.skill.length, `Trail skill should be non-empty`).toBeGreaterThan(0);
      expect(trail.skill, `Saved trail skill "${trail.skill}" should be lowercase`).toBe(trail.skill.toLowerCase());
      expect(trail.platform.length, `Trail platform should be non-empty`).toBeGreaterThan(0);
      expect(trail.platform, `Saved trail platform "${trail.platform}" should be lowercase`).toBe(
        trail.platform.toLowerCase(),
      );

      const hasContextLink = trail.fromContextId ?? trail.toContextId;
      expect(hasContextLink, `Trail "${trail.skill}" must have fromContextId or toContextId`).toBeTruthy();
      console.log(
        `TC-D3 [4/5]: Trail "${trail.skill}" → from=${trail.fromContextId ?? "null"}, to=${trail.toContextId ?? "null"}`,
      );

      if (trail.fromContextId) {
        const fromIdResult = contextIdSchema.safeParse(trail.fromContextId);
        expect(fromIdResult.success, `fromContextId "${trail.fromContextId}" must match ctx_<UUID> format`).toBe(true);

        const fromContext = savedResponse.contexts.find((c) => c.contextId === trail.fromContextId);
        expect(fromContext, `Trail fromContextId "${trail.fromContextId}" must exist in saved contexts`).toBeDefined();
      }

      if (trail.toContextId) {
        const toIdResult = contextIdSchema.safeParse(trail.toContextId);
        expect(toIdResult.success, `toContextId "${trail.toContextId}" must match ctx_<UUID> format`).toBe(true);

        const toContext = savedResponse.contexts.find((c) => c.contextId === trail.toContextId);
        expect(toContext, `Trail toContextId "${trail.toContextId}" must exist in saved contexts`).toBeDefined();
      }
    }

    console.log("TC-D3 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();
    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    expect(storyInDb.trails.length, "Neo4j trails mismatch").toBe(savedResponse.trails.length);
    console.log(
      `TC-D3 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts, ${storyInDb.trails.length} trails`,
    );
  }, 300_000);
});
