import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HumanMessage } from "@langchain/core/messages";

import { responseBuilders } from "../../../src/facade/langchain/cold-start/response-builders.js";
import { PHASE, coldStartStateSchema } from "../../../src/facade/langchain/cold-start/types.js";
import { TOOL_NAME } from "../../../src/facade/langchain/cold-start/workflow-constants.js";
import { InvalidStateError } from "../../../src/facade/mcp-server/tools/errors.js";

import type { ColdStartState } from "../../../src/facade/langchain/cold-start/types.js";
import type { ToolName } from "../../../src/facade/langchain/cold-start/workflow-constants.js";

/**
 * Contract Smoke Tests (C01-C05)
 *
 * Цель: Проверить internal contracts БЕЗ LLM calls.
 * Время выполнения: ~100ms (статический анализ)
 *
 * Эти тесты ПОЙМАЛИ БЫ ошибку с ToolMessage routing
 * (plan_career_history говорил "call confirm_plan" вместо "call show_plan")
 */

const TOOLS_DIR = path.resolve(import.meta.dirname, "../../../src/facade/langchain/cold-start/tools");

function readToolSource(toolFileName: string): string {
  return readFileSync(path.resolve(TOOLS_DIR, toolFileName), "utf8");
}

function extractDescriptionBlock(source: string): string {
  const match = source.match(/description:\s*([\s\S]*?)schema:/);
  return match?.[1]?.toLowerCase() ?? "";
}

function createBaseState(overrides: Partial<ColdStartState> = {}): ColdStartState {
  return {
    messages: [new HumanMessage("test")],
    phase: PHASE.story_gathering,
    queue: [],
    collectedContexts: [],
    collectedTrails: [],
    missingFields: [],
    clarificationRound: 0,
    userId: "usr_test_00000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

describe("Contract Smoke Tests (C01-C05)", () => {
  /**
   * C01: ToolMessage Routing Consistency
   *
   * Business rule: Каждый tool должен направлять на ПРАВИЛЬНЫЙ следующий tool.
   * Это тест который ПОЙМАЛ БЫ нашу ошибку!
   */
  describe("C01: ToolMessage routing consistency", () => {
    it("plan_career_history → show_plan", () => {
      const source = readToolSource("plan-career-history.tool.ts");

      // ToolMessage должен содержать routing на show_plan (через константу или литерал)
      expect(source).toMatch(/call.*show_plan|TOOL_NAME\.show_plan/);
      // НЕ должен содержать старый routing
      expect(source).not.toMatch(/Now call confirm_plan(?! )/);
    });

    it("process_entity_batch → show_context (success) or ask_clarification (clarification)", () => {
      const source = readToolSource("process-entity-batch.tool.ts");

      // Success case: должен направлять на show_context (через константу или литерал)
      expect(source).toMatch(/call.*show_context|TOOL_NAME\.show_context/);
      // Clarification case: должен направлять на ask_clarification
      expect(source).toMatch(/call.*ask_clarification|TOOL_NAME\.ask_clarification/);

      // НЕ должен напрямую направлять на confirm_context
      expect(source).not.toMatch(/MUST call confirm_context/);
    });

    it("confirm_plan → process_entity_batch", () => {
      const source = readToolSource("confirm-plan.tool.ts");

      expect(source).toContain("process_entity_batch");
    });

    it("confirm_context → process_entity_batch or show_final", () => {
      const source = readToolSource("confirm-context.tool.ts");

      expect(source).toContain("process_entity_batch");
      expect(source).toContain("show_final");
    });

    it("edit_context → show_context", () => {
      const source = readToolSource("edit-context.tool.ts");

      expect(source).toContain("show_context");
      // НЕ должен направлять на confirm_context
      expect(source).not.toMatch(/call confirm_context/);
    });

    it("edit_trail → show_context", () => {
      const source = readToolSource("edit-trail.tool.ts");

      expect(source).toContain("show_context");
      // НЕ должен направлять на confirm_context
      expect(source).not.toMatch(/call confirm_context/);
    });

    it("cancel_workflow sets phase to failed", () => {
      const source = readToolSource("cancel-workflow.tool.ts");

      // Должен устанавливать phase: failed
      expect(source).toContain("PHASE.failed");
      // Должен содержать сообщение о cancel
      expect(source).toMatch(/cancel|cancelled/i);
    });
  });

  /**
   * C02: Tool Descriptions Match Workflow
   *
   * Business rule: Description каждого tool должен соответствовать workflow.
   * Проверяем весь description block (может быть multi-line string concatenation).
   */
  describe("C02: Tool descriptions match workflow", () => {
    it("plan_career_history description mentions show_plan", () => {
      const source = readToolSource("plan-career-history.tool.ts");
      const descriptionBlock = extractDescriptionBlock(source);

      expect(descriptionBlock).toContain("show_plan");
      expect(descriptionBlock).not.toContain("confirm_plan");
    });

    it("process_entity_batch description mentions show_context", () => {
      const source = readToolSource("process-entity-batch.tool.ts");
      const descriptionBlock = extractDescriptionBlock(source);

      expect(descriptionBlock).toContain("show_context");
    });
  });

  /**
   * C03: Phase Guards Exist
   *
   * Business rule: confirm_* tools ДОЛЖНЫ проверять phase перед выполнением.
   */
  describe("C03: Phase guards exist in confirm_* tools", () => {
    const CONFIRM_TOOLS = ["confirm-plan.tool.ts", "confirm-context.tool.ts", "confirm-final.tool.ts"];

    for (const toolFile of CONFIRM_TOOLS) {
      it(`${toolFile} imports and uses phaseGuard`, () => {
        const source = readToolSource(toolFile);

        // Должен импортировать phaseGuard
        expect(source).toContain("phaseGuard");
        // Должен импортировать из shared-tools/guards.js
        expect(source).toContain('from "../../shared-tools/guards.js"');
        // Должен вызывать phaseGuard
        expect(source).toMatch(/phaseGuard\s*\(/);
      });
    }
  });

  /**
   * C04: Workflow Constants Consistency
   *
   * Business rule: TOOL_NAME должен содержать все tools из agent.
   */
  describe("C04: Workflow constants are complete", () => {
    const EXPECTED_TOOLS: ToolName[] = [
      "plan_career_history",
      "show_plan",
      "confirm_plan",
      "process_entity_batch",
      "show_context",
      "confirm_context",
      "edit_context",
      "edit_trail",
      "show_final",
      "confirm_final",
      "ask_clarification",
      "cancel_workflow",
    ];

    it("TOOL_NAME contains all workflow tools", () => {
      for (const toolName of EXPECTED_TOOLS) {
        expect(TOOL_NAME).toHaveProperty(toolName);
        expect(TOOL_NAME[toolName]).toBe(toolName);
      }
    });

    it("PHASE enum has all phases", () => {
      const expectedPhases = [
        "story_gathering",
        "awaiting_plan_confirmation",
        "awaiting_clarification",
        "awaiting_context_confirmation",
        "awaiting_final_confirmation",
        "saved",
        "already_saved",
        "failed",
      ];

      for (const phase of expectedPhases) {
        expect(PHASE).toHaveProperty(phase);
      }
    });
  });

  /**
   * C05: State Schema and Response Builders Consistency
   *
   * Business rule: State должен содержать все поля для построения response в каждой фазе.
   * Response builders должны бросать InvalidStateError при недостатке данных.
   *
   * Этот тест поймал бы:
   * - Missing fields при создании response
   * - Runtime "undefined" errors
   * - Несоответствие state schema и response builders
   */
  describe("C05: State schema and response builders consistency", () => {
    const VALID_CONTEXT = {
      contextId: "ctx_01933ec5-0000-0000-0000-000000000001",
      previousContextId: null,
      nextContextId: null,
      createdAt: "2024-01-01T00:00:00Z",
      creationReason: ["started_working" as const],
      position: "senior",
      industry: "tech",
      companySize: "startup",
      domains: ["backend"],
      skills: ["python", "typescript"],
      countryCode: "de",
      cityName: "berlin",
      birthYear: 1990,
      educationLevel: "BACHELOR" as const,
      citizenships: ["de"],
    };

    const VALID_QUEUE_ITEM = {
      contextId: "ctx_01933ec5-0000-0000-0000-000000000001",
      preview: "Senior Backend at Startup 2023-2024",
      incomingTrails: [],
    };

    const VALID_MISSING_FIELD = {
      field: "position",
      entityLabel: "Context at Google",
      entityType: "context" as const,
      zodMessage: "Required",
    };

    it("state schema parses valid minimal state", () => {
      const minimalState = {
        messages: [new HumanMessage("hello")],
        userId: "usr_test_00000000-0000-0000-0000-000000000001",
      };

      const result = coldStartStateSchema.safeParse(minimalState);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phase).toBe(PHASE.story_gathering);
        expect(result.data.queue).toEqual([]);
        expect(result.data.collectedContexts).toEqual([]);
      }
    });

    it("story_gathering: builds response without special state", () => {
      const state = createBaseState({ phase: PHASE.story_gathering });

      const response = responseBuilders[PHASE.story_gathering](state);

      expect(response.phase).toBe(PHASE.story_gathering);
      expect(response.message).toBeDefined();
    });

    it("awaiting_plan_confirmation: requires non-empty queue", () => {
      const validState = createBaseState({
        phase: PHASE.awaiting_plan_confirmation,
        queue: [VALID_QUEUE_ITEM],
      });

      const response = responseBuilders[PHASE.awaiting_plan_confirmation](validState);
      expect(response.phase).toBe(PHASE.awaiting_plan_confirmation);
      expect(response.queue.length).toBe(1);
    });

    it("awaiting_plan_confirmation: throws on empty queue", () => {
      const invalidState = createBaseState({
        phase: PHASE.awaiting_plan_confirmation,
        queue: [],
      });

      expect(() => responseBuilders[PHASE.awaiting_plan_confirmation](invalidState)).toThrow(InvalidStateError);
    });

    it("awaiting_clarification: requires non-empty missingFields", () => {
      const validState = createBaseState({
        phase: PHASE.awaiting_clarification,
        missingFields: [VALID_MISSING_FIELD],
      });

      const response = responseBuilders[PHASE.awaiting_clarification](validState);
      expect(response.phase).toBe(PHASE.awaiting_clarification);
      expect(response.missingFields.length).toBe(1);
    });

    it("awaiting_clarification: throws on empty missingFields", () => {
      const invalidState = createBaseState({
        phase: PHASE.awaiting_clarification,
        missingFields: [],
      });

      expect(() => responseBuilders[PHASE.awaiting_clarification](invalidState)).toThrow(InvalidStateError);
    });

    it("awaiting_context_confirmation: requires currentEntityContext and collectedContexts", () => {
      const validState = createBaseState({
        phase: PHASE.awaiting_context_confirmation,
        currentEntityContext: { contextIndex: 0, preview: "Senior Backend" },
        collectedContexts: [VALID_CONTEXT],
        queue: [VALID_QUEUE_ITEM],
      });

      const response = responseBuilders[PHASE.awaiting_context_confirmation](validState);
      expect(response.phase).toBe(PHASE.awaiting_context_confirmation);
      expect(response.entity).toBeDefined();
      expect(response.progress.current).toBe(1);
      expect(response.progress.total).toBe(1);
    });

    it("awaiting_context_confirmation: throws without currentEntityContext", () => {
      const invalidState = createBaseState({
        phase: PHASE.awaiting_context_confirmation,
        collectedContexts: [VALID_CONTEXT],
        queue: [VALID_QUEUE_ITEM],
      });

      expect(() => responseBuilders[PHASE.awaiting_context_confirmation](invalidState)).toThrow(InvalidStateError);
    });

    it("awaiting_context_confirmation: throws without collectedContexts", () => {
      const invalidState = createBaseState({
        phase: PHASE.awaiting_context_confirmation,
        currentEntityContext: { contextIndex: 0, preview: "Senior Backend" },
        collectedContexts: [],
        queue: [VALID_QUEUE_ITEM],
      });

      expect(() => responseBuilders[PHASE.awaiting_context_confirmation](invalidState)).toThrow(InvalidStateError);
    });

    it("awaiting_final_confirmation: builds from collectedContexts and collectedTrails", () => {
      const validState = createBaseState({
        phase: PHASE.awaiting_final_confirmation,
        collectedContexts: [VALID_CONTEXT],
        collectedTrails: [],
      });

      const response = responseBuilders[PHASE.awaiting_final_confirmation](validState);
      expect(response.phase).toBe(PHASE.awaiting_final_confirmation);
      expect(response.preview.contexts.length).toBe(1);
      expect(response.summary.contextsCount).toBe(1);
      expect(response.summary.trailsCount).toBe(0);
    });

    it("saved: builds from userId and collected data", () => {
      const validState = createBaseState({
        phase: PHASE.saved,
        collectedContexts: [VALID_CONTEXT],
        collectedTrails: [],
      });

      const response = responseBuilders[PHASE.saved](validState);
      expect(response.phase).toBe(PHASE.saved);
      expect(response.userId).toBe(validState.userId);
      expect(response.contexts.length).toBe(1);
      expect(response.trails.length).toBe(0);
    });

    it("already_saved: builds static response", () => {
      const state = createBaseState({ phase: PHASE.already_saved });

      const response = responseBuilders[PHASE.already_saved](state);
      expect(response.phase).toBe(PHASE.already_saved);
      expect(response.message).toBeDefined();
    });

    it("failed: builds static response", () => {
      const state = createBaseState({ phase: PHASE.failed });

      const response = responseBuilders[PHASE.failed](state);
      expect(response.phase).toBe(PHASE.failed);
      expect(response.message).toBeDefined();
    });

    it("all phases have corresponding response builder", () => {
      const allPhases = Object.values(PHASE);

      for (const phase of allPhases) {
        expect(responseBuilders).toHaveProperty(phase);
        expect(typeof responseBuilders[phase]).toBe("function");
      }
    });
  });
});
