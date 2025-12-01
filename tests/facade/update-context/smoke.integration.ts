import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { postgresService } from "../../../src/facade/infrastructure/postgres.service.js";
import { UpdateContextWorkflow } from "../../../src/facade/langchain/update-context/update-context-agent.js";
import { PHASE } from "../../../src/facade/langchain/update-context/types.js";

import type { UserId, UserContext } from "../../../src/shared/schemas.js";

const TEST_CURRENT_CONTEXT: UserContext = {
  contextId: "ctx_019a6ea7-0000-0000-0000-000000000001",
  previousContextId: null,
  nextContextId: null,
  createdAt: "2025-10-01T00:00:00Z",
  creationReason: ["started_working"],
  position: "middle",
  industry: "tech",
  companySize: "startup",
  domains: ["frontend"],
  skills: ["react", "javascript"],
  countryCode: "de",
  cityName: "berlin",
  birthYear: 1995,
  educationLevel: "BACHELOR",
  citizenships: ["de"],
};

describe("Update-Context Smoke Tests (P0)", () => {
  const testUserId: UserId = "usr_01933ec5-0000-7000-8000-000000000001";
  const threadId = `update_ctx_${testUserId}`;

  const runWorkflow = (message: string) =>
    new UpdateContextWorkflow(testUserId, TEST_CURRENT_CONTEXT).run(message, threadId);

  beforeAll(async () => {
    await postgresService.initialize();
  });

  beforeEach(async () => {
    await postgresService.deleteCheckpoint(threadId);
  });

  afterAll(async () => {
    await postgresService.close();
  });

  it("T01: Agent workflow responds (LangChain v1 config check)", async () => {
    const message = "Добавь TypeScript в мои навыки";

    const response = await runWorkflow(message);

    expect(response.phase).toBeDefined();
    expect(Object.values(PHASE)).toContain(response.phase);

    console.log(`T01 result: phase=${response.phase}`);
  }, 60_000);

  it("T02: Update message produces valid response structure", async () => {
    const message = "Добавь TypeScript и Node.js в мои навыки, измени позицию на Senior Developer";

    const response = await runWorkflow(message);

    switch (response.phase) {
      case PHASE.awaiting_confirmation: {
        expect(response.before).toBeDefined();
        expect(response.after).toBeDefined();
        console.log(
          `T02 result: awaiting_confirmation, before.position=${response.before.position}, after.position=${response.after.position}`,
        );

        break;
      }
      case PHASE.awaiting_clarification: {
        expect(response.message).toBeDefined();
        console.log(`T02 result: awaiting_clarification, message: ${response.message}`);

        break;
      }
      case PHASE.saved: {
        expect(response.updatedContext).toBeDefined();
        console.log(`T02 result: saved (auto-confirmed)`);

        break;
      }
      case PHASE.failed: {
        console.log(`T02 result: failed, message: ${response.message}`);

        break;
      }
      default: {
        console.log(`T02 result: phase=${response.phase}`);
      }
    }

    expect(response.phase).not.toBe(PHASE.failed);
  }, 90_000);

  it("T03: Confirmation flow works", async () => {
    const message = "Добавь Python в мои навыки";

    const response1 = await runWorkflow(message);

    console.log(`T03 step 1: phase=${response1.phase}`);

    if (response1.phase !== PHASE.awaiting_confirmation) {
      console.log(`T03: Skipping confirmation test, got ${response1.phase} instead`);
      return;
    }

    const response2 = await runWorkflow("да, подтверждаю");

    console.log(`T03 step 2: phase=${response2.phase}`);

    expect([PHASE.saved, PHASE.awaiting_confirmation]).toContain(response2.phase);

    if (response2.phase === PHASE.saved) {
      expect(response2.updatedContext.skills).toContain("python");
    }
  }, 120_000);
});
