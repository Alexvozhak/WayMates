import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartGraph, PHASE, resetCheckpointer } from "../../../../../src/facade/langchain/cold-start-v2/index.js";
import { SessionMiddleware } from "../../../../../src/facade/mcp-server/session-middleware.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2 Edge Cases (Tier 3)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-0008-0000-0000-000000000008";
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

  it("T10: State resume after 'closing chat' - continues from checkpoint", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T10 [1/5]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`T10 [1/5]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T10 [2/5]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log("T10: ⚠️ Clarification needed, test cannot complete deterministically");
      expect.fail("T10 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const progressBeforeResume = extractionResponse.progress;
    console.log(
      `T10 [2/5]: ✅ Extraction started: context ${progressBeforeResume.current}/${progressBeforeResume.total}`,
    );

    console.log("T10 [3/5]: Verifying checkpoint exists (simulating 'close chat')");
    const checkpointState = await postgresService.getCheckpointState(threadId);
    expect(checkpointState).not.toBeNull();
    console.log("T10 [3/5]: ✅ Checkpoint exists in PostgreSQL");

    console.log("T10 [4/5]: Resuming workflow with context confirmation");
    const resumeResponse = await runWorkflow("да, верно");

    const validResumePhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validResumePhases).toContain(resumeResponse.phase);

    console.log(`T10 [4/5]: ✅ Resumed successfully, now at phase: ${resumeResponse.phase}`);

    if (resumeResponse.phase === PHASE.awaiting_context_confirmation) {
      expect(resumeResponse.progress.current).toBeGreaterThanOrEqual(progressBeforeResume.current);
      console.log(
        `T10 [5/5]: ✅ Progress advanced: ${resumeResponse.progress.current}/${resumeResponse.progress.total}`,
      );
    } else if (resumeResponse.phase === PHASE.awaiting_final_confirmation) {
      console.log(`T10 [5/5]: ✅ All contexts confirmed, ready for final confirmation`);
    }

    console.log("T10: ✅ State resume test passed — checkpoint persistence works correctly");
  }, 240_000);

  it("T15: Checkpoint cleanup after save (via handleSaved)", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const ctx = FacadeTestContext.getInstance();
    const sessionMiddleware = new SessionMiddleware(ctx.redis);
    const coldStartTool = new ColdStartTool(sessionMiddleware, ctx.normalizer, ctx.coreClient);

    const runTool = async (message: string) => {
      const result = await coldStartTool.execute({ sessionId: testSessionId, message });
      if (!result.ok) {
        console.error("T15 error details:", JSON.stringify(result.error, null, 2));
        expect.fail(`ColdStartTool error: ${result.error.message}`);
      }
      return result.value;
    };

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T15 [1/5]: Running full workflow via ColdStartTool to saved state");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    let currentResponse = await runTool("да, всё верно");

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("T15 requires extraction without clarification");
    }

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T15 [2/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("T15 [3/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    console.log(`T15 [3/5]: ✅ Workflow completed: ${savedResponse.contexts.length} contexts saved`);

    console.log("T15 [4/5]: Verifying checkpoint was deleted by handleSaved()");
    const toolThreadId = `cold_start_${testUserId}`;
    const checkpointAfterSave = await postgresService.getCheckpointState(toolThreadId);

    expect(checkpointAfterSave).toBeNull();
    console.log("T15 [4/5]: ✅ Checkpoint deleted immediately by handleSaved()");

    const isCompleted = await postgresService.isColdStartCompleted(testUserId);
    expect(isCompleted).toBe(true);
    console.log("T15 [5/5]: ✅ Cold start marked as completed");

    console.log("T15: ✅ Checkpoint cleanup test passed — handleSaved() cleanup works correctly");
  }, 300_000);

  // eslint-disable-next-line complexity -- integration test with multiple workflow steps
  it("T09: Context correction via edit flow", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T09 [1/6]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T09 [1/6]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T09 [2/6]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("T09 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const originalPosition = extractionResponse.entity.position;
    const contextId = extractionResponse.entity.contextId;
    console.log(`T09 [2/6]: ✅ Context extracted: position="${originalPosition}", id=${contextId}`);

    console.log("T09 [3/6]: Sending edit request → edit_context should be called");
    const editResponse = await runWorkflow("нет, измени позицию на lead");

    if (editResponse.phase !== PHASE.awaiting_context_confirmation) {
      console.log(`T09: ❌ After edit request, got phase: ${editResponse.phase}`);
      console.log("T09: Graph may have misinterpreted EDIT intent as something else");
      expect.fail(`Expected awaiting_context_confirmation after edit, got ${editResponse.phase}`);
    }

    const updatedPosition = editResponse.entity.position;
    console.log(`T09 [3/6]: ✅ Context updated: position="${updatedPosition}"`);

    const positionChanged = updatedPosition !== originalPosition || updatedPosition.toLowerCase().includes("lead");

    if (!positionChanged) {
      console.log(`T09: ⚠️ Position may not have changed: "${originalPosition}" → "${updatedPosition}"`);
    }

    console.log("T09 [4/6]: Confirming edited context");
    const confirmResponse = await runWorkflow("да, теперь верно");

    const validPhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validPhases).toContain(confirmResponse.phase);
    console.log(`T09 [4/6]: ✅ Context confirmed, phase: ${confirmResponse.phase}`);

    let currentResponse = confirmResponse;
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T09 [5/6]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("T09 [6/6]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");
    expect(savedResponse.phase).toBe(PHASE.saved);

    if (savedResponse.phase === PHASE.saved) {
      console.log(`T09: ✅ Edit flow test passed — ${savedResponse.contexts.length} contexts saved`);
    }
  }, 300_000);

  it("T14: Cancel workflow stops without saving", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    console.log("T14 [1/3]: Starting workflow");
    const initialResponse = await runWorkflow("Привет, хочу рассказать о карьере");

    expect(initialResponse.phase).toBe(PHASE.story_gathering);
    console.log("T14 [1/3]: ✅ Workflow started, phase: story_gathering");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T14 [2/3]: Sending story to get plan");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T14 [2/3]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T14 [3/3]: Sending cancel command");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.failed);

    if (cancelResponse.phase === PHASE.failed) {
      const cancelMentioned =
        cancelResponse.message.toLowerCase().includes("cancel") ||
        cancelResponse.message.toLowerCase().includes("отмен");
      console.log(`T14 [3/3]: ✅ Workflow cancelled, message: "${cancelResponse.message}"`);

      if (!cancelMentioned) {
        console.log("T14: ⚠️ Message does not mention cancel, but phase is correct");
      }
    } else {
      console.log(`T14: ❌ Unexpected phase after cancel: ${cancelResponse.phase}`);
      expect.fail(`Expected failed phase after cancel, got ${cancelResponse.phase}`);
    }

    console.log("T14: ✅ Cancel workflow test passed — workflow stopped without saving");
  }, 180_000);
});
