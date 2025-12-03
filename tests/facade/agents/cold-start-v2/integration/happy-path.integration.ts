import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartGraph, PHASE, resetCheckpointer } from "../../../../../src/facade/langchain/cold-start-v2/index.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2 Happy Path Tests (LangGraph)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-0002-0000-0000-000000000002";
  const threadId = `cold_start_v2_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> =>
    new ColdStartGraph(testUserId).run(message, threadId);

  beforeAll(async () => {
    FacadeTestContext.initialize();
    await postgresService.initialize();
  });

  beforeEach(async () => {
    const [_session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    await cleanupColdStart(testUserId, threadId);
    resetCheckpointer();
    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
    await postgresService.close();
  });

  it("T06: Full workflow phase transitions", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T06 [1/4]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    expect(planResponse.phase).toBe(PHASE.awaiting_plan_confirmation);
    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    expect(planResponse.queue.length).toBeGreaterThan(0);

    console.log(`T06 [1/4]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T06 [2/4]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T06 [2/4]: ✅ Extraction started (context ${extractionResponse.progress.current}/${extractionResponse.progress.total})`,
      );
    } else if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log(`T06 [2/4]: ⚠️ Clarification needed (${extractionResponse.missingFields.length} fields)`);
      expect.fail("T06 requires successful extraction without clarification (use simpler story or check LLM)");
    } else {
      expect.fail(`Unexpected phase after plan confirmation: ${extractionResponse.phase}`);
    }

    console.log("T06 [3/4]: Confirming contexts → awaiting_final_confirmation");

    const firstContextConfirm = await runWorkflow("да, верно");

    let lastResponse = firstContextConfirm;

    while (lastResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = lastResponse.progress;
      console.log(`T06 [3/4]: Confirmed context ${current}/${total}, continuing...`);

      lastResponse = await runWorkflow("да, верно");
    }

    expect(lastResponse.phase).toBe(PHASE.awaiting_final_confirmation);
    if (lastResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation after all contexts, got ${lastResponse.phase}`);
    }

    console.log(
      `T06 [3/4]: ✅ All contexts confirmed (${lastResponse.summary.contextsCount} contexts, ${lastResponse.summary.trailsCount} trails)`,
    );

    console.log("T06 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    expect(savedResponse.contexts.length).toBeGreaterThan(0);
    expect(savedResponse.userId).toBe(testUserId);

    console.log(`T06 [4/4]: ✅ Workflow complete! Saved ${savedResponse.contexts.length} contexts`);
  }, 240_000);

  it("T03: Multi-context (3+) → saved with U10 fixture", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T03 [1/4]: Sending U10 story (3 contexts + 2 trails)");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      console.log("T03: Response:", JSON.stringify(planResponse, null, 2));
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    expect(planResponse.queue.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [1/4]: ✅ Plan has ${planResponse.queue.length} contexts in queue`);

    const contextsWithTrails = planResponse.queue.filter((q) => q.incomingTrails.length > 0);
    console.log(`T03 [1/4]: ${contextsWithTrails.length} contexts have incoming trails`);

    console.log("T03 [2/4]: Confirming plan...");
    let currentResponse = await runWorkflow("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T03 [3/4]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");
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
      `T03 [3/4]: ✅ Final summary: ${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails`,
    );

    console.log("T03 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      console.log("T03: Response:", JSON.stringify(savedResponse, null, 2));
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [4/4]: ✅ Saved ${savedResponse.contexts.length} contexts`);
  }, 300_000);

  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("T07: Trails extraction with correct context links", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T07 [1/4]: Sending U10 story for trails extraction");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    const totalIncomingTrails = planResponse.queue.reduce((sum, q) => sum + q.incomingTrails.length, 0);
    console.log(`T07 [1/4]: Plan queue has ${totalIncomingTrails} total incoming trail references`);

    console.log("T07 [2/4]: Confirming plan...");
    let currentResponse = await runWorkflow("да, всё верно");

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T07 [3/4]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );

      const trails = currentResponse.relatedTrails;
      if (trails.length > 0) {
        console.log(`T07 [3/4]: Context has ${trails.length} related trail(s)`);
      }
      for (const trail of trails) {
        expect(trail.skill).toBeDefined();
        expect(trail.platform).toBeDefined();
      }

      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("T07: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("T07 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log(`T07 [3/4]: Summary shows ${currentResponse.summary.trailsCount} trails`);

    console.log("T07 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    expect(savedResponse.trails.length).toBeGreaterThanOrEqual(1);
    console.log(`T07 [4/4]: ✅ Saved ${savedResponse.trails.length} trail(s) (expected >= 1)`);

    for (const trail of savedResponse.trails) {
      expect(trail.trailId).toMatch(/^trl_/);
      expect(trail.skill).toBeDefined();
      expect(trail.platform).toBeDefined();

      const hasContextLink = trail.fromContextId || trail.toContextId;
      expect(hasContextLink).toBeTruthy();
      console.log(`T07 [4/4]: Trail "${trail.skill}" has context link: ${hasContextLink ? "✅" : "❌"}`);

      if (trail.fromContextId) {
        const fromExists = savedResponse.contexts.some((c) => c.contextId === trail.fromContextId);
        expect(fromExists).toBe(true);
      }

      if (trail.toContextId) {
        const toExists = savedResponse.contexts.some((c) => c.contextId === trail.toContextId);
        expect(toExists).toBe(true);
      }
    }
  }, 300_000);
});
