import { beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2 Smoke Tests (P0)", () => {
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

  it("T01: Graph workflow responds (LangGraph config check)", async () => {
    const message = "Hello";

    const response = await runWorkflow(message);

    expect(response.phase).toBe("story_gathering");
  });

  it("T02: Story produces valid discriminated response", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const response = await runWorkflow(storyWithTrigger);

    if (response.phase === "story_gathering") {
      expect(response.message.length).toBeGreaterThan(0);
    } else if (response.phase === "awaiting_plan_confirmation") {
      expect(response.queue.length).toBeGreaterThan(0);

      const firstContext = response.queue[0]!;
      expect(firstContext.preview.length).toBeGreaterThan(0);
      expect(firstContext.contextId).toMatch(/^ctx_[\da-f-]{36}$/);
    } else {
      expect.fail(`Unexpected phase after story: ${response.phase}`);
    }

    console.log(
      `T02 result: phase=${response.phase}, queue=${response.phase === "awaiting_plan_confirmation" ? response.queue.length : "N/A"}`,
    );
  }, 120_000);

  it("T02.5: Plan confirmation triggers extraction", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`T02.5 step 1: plan created with ${planResponse.queue.length} contexts`);

    const confirmResponse = await runWorkflow("да, всё верно");

    if (confirmResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T02.5 result: extracted "${confirmResponse.entity.position}" (${confirmResponse.progress.current}/${confirmResponse.progress.total})`,
      );
    } else if (confirmResponse.phase === PHASE.awaiting_clarification) {
      console.log(`T02.5 result: clarification needed for ${confirmResponse.missingFields.length} field(s)`);
    } else {
      expect.fail(`Expected extraction phase, got ${confirmResponse.phase}`);
    }
  }, 180_000);
});
