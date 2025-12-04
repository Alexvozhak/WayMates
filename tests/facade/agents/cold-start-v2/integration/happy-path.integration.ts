import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { PHASE, resetCheckpointer } from "../../../../../src/facade/langchain/cold-start-v2/index.js";
import { SessionMiddleware } from "../../../../../src/facade/mcp-server/session-middleware.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { ColdStartResponse } from "../../../../../src/facade/langchain/cold-start/types.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2 Happy Path Tests (LangGraph)", () => {
  let testSessionId: SessionId;
  let coldStartTool: ColdStartTool;
  const testUserId: UserId = "usr_01933ec5-0002-0000-0000-000000000002";
  const threadId = `cold_start_${testUserId}`;

  const runTool = async (message: string): Promise<ColdStartResponse> => {
    const result = await coldStartTool.execute({ sessionId: testSessionId, message });
    if (!result.ok) {
      console.error(`ColdStartTool error:`, JSON.stringify(result.error, null, 2));
      throw new Error(`ColdStartTool failed: ${result.error.message}`);
    }
    return result.value;
  };

  beforeAll(async () => {
    FacadeTestContext.initialize();
    await postgresService.initialize();
  });

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();

    await cleanupColdStart(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);
    resetCheckpointer();

    const [_session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    const sessionMiddleware = new SessionMiddleware(ctx.redis);
    coldStartTool = new ColdStartTool(sessionMiddleware, ctx.normalizer, ctx.coreClient);

    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
    await postgresService.close();
  });

  it("T06: Full workflow phase transitions + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T06 [1/5]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runTool(storyWithTrigger);

    expect(planResponse.phase).toBe(PHASE.awaiting_plan_confirmation);
    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    expect(planResponse.queue.length).toBeGreaterThan(0);

    console.log(`T06 [1/5]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T06 [2/5]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runTool("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T06 [2/5]: ✅ Extraction started (context ${extractionResponse.progress.current}/${extractionResponse.progress.total})`,
      );
    } else if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log(`T06 [2/5]: ⚠️ Clarification needed (${extractionResponse.missingFields.length} fields)`);
      expect.fail("T06 requires successful extraction without clarification (use simpler story or check LLM)");
    } else {
      expect.fail(`Unexpected phase after plan confirmation: ${extractionResponse.phase}`);
    }

    console.log("T06 [3/5]: Confirming contexts → awaiting_final_confirmation");

    let currentResponse = await runTool("да, верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = currentResponse.progress;
      console.log(`T06 [3/5]: Confirmed context ${current}/${total}, continuing...`);

      currentResponse = await runTool("да, верно");
    }

    expect(currentResponse.phase).toBe(PHASE.awaiting_final_confirmation);
    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation after all contexts, got ${currentResponse.phase}`);
    }

    console.log(
      `T06 [3/5]: ✅ All contexts confirmed (${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails)`,
    );

    console.log("T06 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    expect(savedResponse.contexts.length).toBeGreaterThan(0);
    expect(savedResponse.userId).toBe(testUserId);

    console.log(`T06 [4/5]: ✅ Workflow complete! Agent reports ${savedResponse.contexts.length} contexts`);

    console.log("T06 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();
    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    console.log(`T06 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts persisted`);
  }, 240_000);

  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("T03: Multi-context (3+) → saved with U10 fixture + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T03 [1/5]: Sending U10 story (3 contexts + 2 trails)");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      console.log("T03: Response:", JSON.stringify(planResponse, null, 2));
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    expect(planResponse.queue.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [1/5]: ✅ Plan has ${planResponse.queue.length} contexts in queue`);

    const contextsWithTrails = planResponse.queue.filter((q) => q.incomingTrails.length > 0);
    console.log(`T03 [1/5]: ${contextsWithTrails.length} contexts have incoming trails`);

    console.log("T03 [2/5]: Confirming plan...");
    let currentResponse = await runTool("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T03 [3/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("T03: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("T03 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      console.log("T03: Response:", JSON.stringify(currentResponse, null, 2));
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    expect(currentResponse.summary.contextsCount).toBeGreaterThanOrEqual(3);
    console.log(
      `T03 [3/5]: ✅ Final summary: ${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails`,
    );

    console.log("T03 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      console.log("T03: Response:", JSON.stringify(savedResponse, null, 2));
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [4/5]: ✅ Agent reports ${savedResponse.contexts.length} contexts saved`);

    console.log("T03 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();

    console.log("T03 [5/5]: Context links debug:");
    for (const c of storyInDb.contexts) {
      console.log(`  - ${c.contextId}: prev=${c.previousContextId ?? "null"}, next=${c.nextContextId ?? "null"}`);
    }

    const nullNextCount = storyInDb.contexts.filter((c) => !c.nextContextId).length;
    console.log(`T03 [5/5]: Contexts with nextContextId=null: ${nullNextCount} (expected: 1)`);

    if (nullNextCount !== 1) {
      console.log("T03 [5/5]: ❌ BUG DETECTED! Full contexts dump:");
      console.log(JSON.stringify(storyInDb.contexts, null, 2));
    }

    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    expect(storyInDb.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts persisted`);
  }, 300_000);

  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("T07: Trails extraction with correct context links + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T07 [1/5]: Sending U10 story for trails extraction");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    const totalIncomingTrails = planResponse.queue.reduce((sum, q) => sum + q.incomingTrails.length, 0);
    console.log(`T07 [1/5]: Plan queue has ${totalIncomingTrails} total incoming trail references`);

    console.log("T07 [2/5]: Confirming plan...");
    let currentResponse = await runTool("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T07 [3/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );

      const trails = currentResponse.relatedTrails;
      if (trails.length > 0) {
        console.log(`T07 [3/5]: Context has ${trails.length} related trail(s)`);
      }
      for (const trail of trails) {
        expect(trail.skill).toBeDefined();
        expect(trail.platform).toBeDefined();
      }

      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("T07: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("T07 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log(`T07 [3/5]: Summary shows ${currentResponse.summary.trailsCount} trails`);

    console.log("T07 [4/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.trails.length).toBeGreaterThanOrEqual(1);
    console.log(`T07 [4/5]: ✅ Agent reports ${savedResponse.trails.length} trail(s) saved`);

    for (const trail of savedResponse.trails) {
      expect(trail.trailId).toMatch(/^trl_/);
      expect(trail.skill).toBeDefined();
      expect(trail.platform).toBeDefined();

      const hasContextLink = trail.fromContextId || trail.toContextId;
      expect(hasContextLink).toBeTruthy();
      console.log(`T07 [4/5]: Trail "${trail.skill}" has context link: ${hasContextLink ? "✅" : "❌"}`);

      if (trail.fromContextId) {
        const fromExists = savedResponse.contexts.some((c) => c.contextId === trail.fromContextId);
        expect(fromExists).toBe(true);
      }

      if (trail.toContextId) {
        const toExists = savedResponse.contexts.some((c) => c.contextId === trail.toContextId);
        expect(toExists).toBe(true);
      }
    }

    console.log("T07 [5/5]: Verifying data saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() did not persist to Neo4j").not.toBeNull();
    expect(storyInDb.contexts.length, "Neo4j contexts mismatch").toBe(savedResponse.contexts.length);
    expect(storyInDb.trails.length, "Neo4j trails mismatch").toBe(savedResponse.trails.length);
    console.log(
      `T07 [5/5]: ✅ Neo4j verified: ${storyInDb.contexts.length} contexts, ${storyInDb.trails.length} trails`,
    );
  }, 300_000);
});
