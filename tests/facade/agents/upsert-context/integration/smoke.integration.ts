import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { UpsertContextWorkflow } from "../../../../../src/facade/langchain/upsert-context/upsert-context-agent.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

describe("UpsertContext Smoke Tests (UC-T01 to UC-T03)", () => {
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c222";
  let sessionId: SessionId;
  let threadId: string;

  beforeAll(async () => {
    await postgresService.initialize();
  });

  afterAll(async () => {
    await postgresService.close();
  });

  beforeEach(async () => {
    threadId = `upsert_ctx_${testUserId}`;
    const [, sid] = await setupSession(testUserId);
    sessionId = sid;

    await postgresService.deleteCheckpoint(threadId);
  });

  afterEach(async () => {
    await postgresService.deleteCheckpoint(threadId);
    await cleanupSession(sessionId);
  });

  // Business rule: User describes career context in NLP → agent extracts structured data.
  // Human-in-the-loop: Before saving, user MUST confirm extracted data (awaiting_confirmation).
  // This prevents incorrect data from corrupting career history due to LLM hallucination.
  it("UC-T01: NLP extraction produces structured context with key fields from input", async () => {
    const workflow = new UpsertContextWorkflow(testUserId);
    const input = "Я работаю senior backend developer в Яндексе с марта 2023 года в Москве, пишу на Python и Go";

    const result = await workflow.run(input, threadId);

    expect(result.phase).toBe("awaiting_confirmation");

    if (result.phase === "awaiting_confirmation") {
      const { context } = result;

      // Position extracted (exact format varies, but must contain senior/backend)
      expect(context.position).toBeTruthy();
      expect(context.position.toLowerCase()).toMatch(/senior|backend/);

      // Skills from input: Python and Go must be extracted
      const skillsLower = context.skills.map((s) => s.toLowerCase());
      expect(skillsLower).toEqual(expect.arrayContaining(["python", "go"]));

      // City: Москва mentioned → must be extracted
      expect(context.cityName).toBeTruthy();

      // Industry: Яндекс → tech industry
      expect(context.industry).toBeTruthy();

      // Domains: backend work → should have backend domain
      expect(context.domains.length).toBeGreaterThan(0);

      // createdAt: "март 2023" → must be 2023-03, NOT today's date
      expect(context.createdAt).toMatch(/^2023-03/);
    }
  });

  // Business rule: User confirms extracted context → system saves to database.
  // Flow: NLP → extraction → show → user says "да" → saved phase.
  // Core API receives validated UserContext; checkpoint is deleted after success.
  it("UC-T02: User confirmation triggers save with valid contextId", async () => {
    const workflow = new UpsertContextWorkflow(testUserId);
    const extractionInput = "Работаю junior frontend в стартапе с января 2024, React и TypeScript";

    const step1 = await workflow.run(extractionInput, threadId);
    expect(step1.phase).toBe("awaiting_confirmation");

    const step2 = await workflow.run("да", threadId);

    expect(step2.phase).toBe("saved");

    if (step2.phase === "saved") {
      // contextId generated with UUID v7 format
      expect(step2.context.contextId).toMatch(/^ctx_[0-9a-f-]{36}$/);

      // Key fields preserved from extraction
      expect(step2.context.position).toBeTruthy();
      expect(step2.context.skills.length).toBeGreaterThan(0);

      // System fields populated
      expect(step2.context.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  // Business rule: User can correct extraction errors before saving.
  // Flow: extraction → show → user says "измени X" → re-extraction → show again.
  // Prevents saving wrong data; user iterates until satisfied.
  it("UC-T03: Edit request modifies context and re-shows for confirmation", async () => {
    const workflow = new UpsertContextWorkflow(testUserId);
    const extractionInput = "Работаю senior QA в банке с 2022 в Питере, Python и Selenium";

    const step1 = await workflow.run(extractionInput, threadId);
    expect(step1.phase).toBe("awaiting_confirmation");

    if (step1.phase !== "awaiting_confirmation") return;

    const originalPosition = step1.context.position;

    // User requests edit: change level from senior to middle
    const step2 = await workflow.run("измени позицию на middle", threadId);

    // Still awaiting_confirmation (not saved yet)
    expect(step2.phase).toBe("awaiting_confirmation");

    if (step2.phase === "awaiting_confirmation") {
      // Position changed: should no longer match original
      expect(step2.context.position).not.toBe(originalPosition);

      // New position should reflect "middle" level (format varies)
      const posLower = step2.context.position.toLowerCase();
      expect(posLower.includes("middle") || posLower.includes("mid")).toBe(true);

      // Other fields preserved (skills should still include Python, Selenium)
      const skillsLower = step2.context.skills.map((s) => s.toLowerCase());
      expect(skillsLower).toEqual(expect.arrayContaining(["python"]));
    }
  });
});
