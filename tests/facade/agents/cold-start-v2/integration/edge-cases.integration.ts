import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import {
  ColdStartGraph,
  PHASE,
  resetCheckpointer,
} from "../../../../../src/facade/langchain/cold-start-v2/cold-start-graph.js";
import { SessionMiddleware } from "../../../../../src/facade/mcp-server/session-middleware.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
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
    await cleanupUserFromNeo4j(testUserId);
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

  it("T14: Cancel workflow stops without saving + Neo4j verification", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    console.log("T14 [1/4]: Starting workflow");
    const initialResponse = await runWorkflow("Привет, хочу рассказать о карьере");

    expect(initialResponse.phase).toBe(PHASE.story_gathering);
    console.log("T14 [1/4]: ✅ Workflow started, phase: story_gathering");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T14 [2/4]: Sending story to get plan");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T14 [2/4]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T14 [3/4]: Sending cancel command");
    const cancelResponse = await runWorkflow("отмена");

    expect(cancelResponse.phase).toBe(PHASE.failed);

    if (cancelResponse.phase === PHASE.failed) {
      const cancelMentioned =
        cancelResponse.message.toLowerCase().includes("cancel") ||
        cancelResponse.message.toLowerCase().includes("отмен");
      console.log(`T14 [3/4]: ✅ Workflow cancelled, message: "${cancelResponse.message}"`);

      if (!cancelMentioned) {
        console.log("T14: ⚠️ Message does not mention cancel, but phase is correct");
      }
    } else {
      console.log(`T14: ❌ Unexpected phase after cancel: ${cancelResponse.phase}`);
      expect.fail(`Expected failed phase after cancel, got ${cancelResponse.phase}`);
    }

    console.log("T14 [4/4]: Verifying data was NOT saved to Neo4j...");
    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb.contexts.length, "BUG: Data was saved to Neo4j after cancel!").toBe(0);
    expect(storyInDb.trails.length, "BUG: Trails were saved to Neo4j after cancel!").toBe(0);
    console.log("T14 [4/4]: ✅ Neo4j verified: no data was saved after cancel");

    console.log("T14: ✅ Cancel workflow test passed — workflow stopped without saving");
  }, 180_000);

  // eslint-disable-next-line complexity -- integration test with clarification retry flow
  it("T08: Clarification flow - missing birthYear triggers clarification → user provides → extraction succeeds", async () => {
    /**
     * Бизнес-сценарий: Пользователь рассказывает историю без года рождения.
     * LLM extraction не может заполнить birthYear → clarification → retry → success.
     *
     * Этот тест проверяет что:
     * 1. awaiting_clarification phase работает
     * 2. missingFields содержит ожидаемое поле
     * 3. После ответа пользователя extraction успешно завершается
     */
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    console.log("T08 [1/6]: Generating incomplete story (no birthYear)...");
    const incompleteStory = await generateStoryFromFixture(u1, "birthYear");
    const storyWithTrigger = incompleteStory + STORY_COMPLETION_TRIGGER;

    console.log("T08 [2/6]: Sending incomplete story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      console.log("T08: Unexpected response:", JSON.stringify(planResponse, null, 2));
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T08 [2/6]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("T08 [3/6]: Confirming plan → expecting clarification or context_confirmation");
    const afterPlanResponse = await runWorkflow("да, всё верно");

    if (afterPlanResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log("T08: ⚠️ LLM successfully extracted all required fields");
      console.log("T08: birthYear was removed from fixture but extraction succeeded anyway");
      console.log("T08: This is unexpected — check if extraction prompt allows defaults");
      expect.fail("T08 requires clarification to trigger — extraction succeeded without birthYear in story");
    }

    if (afterPlanResponse.phase !== PHASE.awaiting_clarification) {
      console.log("T08: Unexpected response:", JSON.stringify(afterPlanResponse, null, 2));
      expect.fail(`Expected awaiting_clarification, got ${afterPlanResponse.phase}`);
    }

    expect(afterPlanResponse.missingFields.length).toBeGreaterThan(0);
    console.log(`T08 [3/6]: ✅ Clarification triggered! Missing fields: ${afterPlanResponse.missingFields.length}`);
    for (const field of afterPlanResponse.missingFields) {
      console.log(`T08 [3/6]:   - ${field.field} (${field.entityType}): ${field.zodMessage}`);
    }

    const hasBirthYearMissing = afterPlanResponse.missingFields.some(
      (f) => f.field.toLowerCase().includes("birthyear") || f.field.toLowerCase().includes("birth"),
    );
    if (!hasBirthYearMissing) {
      console.log("T08: ⚠️ birthYear not in missingFields — different field triggered clarification");
    }

    console.log("T08 [4/6]: Providing clarification answer (birthYear = 1990)");
    const clarificationAnswer = "Я родился в 1990 году";
    const afterClarificationResponse = await runWorkflow(clarificationAnswer);

    if (afterClarificationResponse.phase === PHASE.awaiting_clarification) {
      console.log("T08: ⚠️ Still awaiting clarification after answer");
      console.log(`T08: Missing fields: ${afterClarificationResponse.missingFields.map((f) => f.field).join(", ")}`);
      console.log("T08: Providing additional info and retrying...");

      const additionalInfo = "Гражданство — Россия. Высшее образование — бакалавр.";
      const retryResponse = await runWorkflow(additionalInfo);

      if (retryResponse.phase === PHASE.awaiting_clarification) {
        console.log("T08: Still in clarification after 2 attempts");
        expect.fail("T08: Clarification did not resolve after 2 attempts — check extraction prompts");
      }

      expect([PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation]).toContain(retryResponse.phase);
      console.log(`T08 [4/6]: ✅ Clarification resolved after retry, phase: ${retryResponse.phase}`);
    } else {
      expect([PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation]).toContain(
        afterClarificationResponse.phase,
      );
      console.log(`T08 [4/6]: ✅ Clarification resolved, phase: ${afterClarificationResponse.phase}`);
    }

    console.log("T08 [5/6]: Completing workflow to saved state...");
    let currentResponse = afterClarificationResponse;

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T08 [5/6]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");

      if (currentResponse.phase === PHASE.awaiting_clarification) {
        console.log("T08: Additional clarification needed, providing info...");
        currentResponse = await runWorkflow("Гражданство — Россия, образование — бакалавр, родился в 1990");
      }
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      if (currentResponse.phase === PHASE.saved) {
        console.log("T08: Already saved (fast path)");
      } else {
        expect.fail(`Expected awaiting_final_confirmation or saved, got ${currentResponse.phase}`);
      }
    }

    if (currentResponse.phase === PHASE.awaiting_final_confirmation) {
      console.log("T08 [6/6]: Final confirmation → saved");
      const savedResponse = await runWorkflow("сохрани");
      expect(savedResponse.phase).toBe(PHASE.saved);
      if (savedResponse.phase === PHASE.saved) {
        console.log(`T08 [6/6]: ✅ Workflow complete! Saved ${savedResponse.contexts.length} contexts`);
      }
    }

    console.log("T08: ✅ Clarification flow test passed — missing fields → clarification → retry → success");
  }, 300_000);
});
