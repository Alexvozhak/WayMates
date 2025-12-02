import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HumanMessage } from "@langchain/core/messages";

import { responseBuilders } from "../../../../../src/facade/langchain/update-context/response-builders.js";
import { PHASE, updateContextStateSchema } from "../../../../../src/facade/langchain/update-context/types.js";
import { InvalidStateError } from "../../../../../src/facade/errors.js";

import type { UpdateContextState } from "../../../../../src/facade/langchain/update-context/types.js";

/**
 * Update-Context Contract Tests (UC-C01-C05)
 *
 * Цель: Проверить internal contracts update-context агента БЕЗ LLM calls.
 * Время выполнения: ~100ms (статический анализ)
 */

const TOOLS_DIR = path.resolve(import.meta.dirname, "../../../../../src/facade/langchain/update-context/tools");

function readToolSource(toolFileName: string): string {
  return readFileSync(path.resolve(TOOLS_DIR, toolFileName), "utf8");
}

describe("Update-Context Contract Tests", () => {
  /**
   * UC-C01: ToolMessage Routing Consistency
   */
  describe("UC-C01: ToolMessage routing consistency", () => {
    it("extract_updates → show_updated_context", () => {
      const source = readToolSource("extract-updates.tool.ts");

      expect(source).toContain("show_updated_context");
    });

    it("confirm_update uses phase from state", () => {
      const source = readToolSource("confirm-update.tool.ts");

      expect(source).toContain("PHASE.saved");
    });

    it("edit_context → show_updated_context", () => {
      const source = readToolSource("edit-context.tool.ts");

      expect(source).toContain("show_updated_context");
    });
  });

  /**
   * UC-C04: Phase Constants Consistency
   */
  describe("UC-C04: Phase constants are complete", () => {
    it("PHASE enum has all update-context phases", () => {
      const expectedPhases = ["collecting", "awaiting_clarification", "awaiting_confirmation", "saved", "failed"];

      for (const phase of expectedPhases) {
        expect(PHASE).toHaveProperty(phase);
      }
    });
  });

  /**
   * UC-C05: State Schema and Response Builders Consistency
   *
   * Business rule: State должен содержать все поля для построения response в каждой фазе.
   */
  describe("UC-C05: State schema and response builders consistency", () => {
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

    // Valid UUID v7 format for createBaseState
    const BASE_USER_ID = "usr_01933ec5-1234-7000-8000-000000000001";

    const createBaseState = (overrides: Partial<UpdateContextState> = {}): UpdateContextState => ({
      messages: [new HumanMessage("test")],
      phase: PHASE.collecting,
      userId: BASE_USER_ID,
      currentContext: VALID_CONTEXT,
      clarificationRound: 0,
      ...overrides,
    });

    it("state schema requires userId and currentContext", () => {
      const stateWithoutRequired = {
        messages: [new HumanMessage("Add Python to my skills")],
      };

      const result = updateContextStateSchema.safeParse(stateWithoutRequired);

      // Both userId and currentContext are required
      expect(result.success).toBe(false);
    });

    it("state schema parses valid state with userId and currentContext", () => {
      const validState = {
        messages: [new HumanMessage("Add Python to my skills")],
        userId: BASE_USER_ID,
        currentContext: VALID_CONTEXT,
      };

      const result = updateContextStateSchema.safeParse(validState);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phase).toBe(PHASE.collecting);
        expect(result.data.clarificationRound).toBe(0);
        expect(result.data.currentContext).toBeDefined();
      }
    });

    it("collecting: builds response without special state", () => {
      const state = createBaseState({ phase: PHASE.collecting });

      const response = responseBuilders[PHASE.collecting](state);

      expect(response.phase).toBe(PHASE.collecting);
      expect(response.message).toBeDefined();
    });

    it("awaiting_clarification: builds response", () => {
      const state = createBaseState({ phase: PHASE.awaiting_clarification });

      const response = responseBuilders[PHASE.awaiting_clarification](state);

      expect(response.phase).toBe(PHASE.awaiting_clarification);
      expect(response.message).toBeDefined();
    });

    it("awaiting_confirmation: requires currentContext and updatedContext", () => {
      const validState = createBaseState({
        phase: PHASE.awaiting_confirmation,
        currentContext: VALID_CONTEXT,
        updatedContext: { ...VALID_CONTEXT, skills: [...VALID_CONTEXT.skills, "go"] },
      });

      const response = responseBuilders[PHASE.awaiting_confirmation](validState);
      expect(response.phase).toBe(PHASE.awaiting_confirmation);
      expect(response.before).toBeDefined();
      expect(response.after).toBeDefined();
    });

    it("awaiting_confirmation: throws InvalidStateError without updatedContext", () => {
      const invalidState = createBaseState({
        phase: PHASE.awaiting_confirmation,
        // currentContext is always present (required in schema)
        // but updatedContext is missing
      });

      expect(() => responseBuilders[PHASE.awaiting_confirmation](invalidState)).toThrow(InvalidStateError);
    });

    it("saved: requires updatedContext", () => {
      const validState = createBaseState({
        phase: PHASE.saved,
        updatedContext: VALID_CONTEXT,
      });

      const response = responseBuilders[PHASE.saved](validState);
      expect(response.phase).toBe(PHASE.saved);
      expect(response.updatedContext).toBeDefined();
    });

    it("saved: throws InvalidStateError without updatedContext", () => {
      const invalidState = createBaseState({
        phase: PHASE.saved,
        // updatedContext is missing
      });

      expect(() => responseBuilders[PHASE.saved](invalidState)).toThrow(InvalidStateError);
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
