import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PHASE } from "../../../src/facade/langchain/cold-start/types.js";
import {
  PHASE_PREREQUISITES,
  TOOL_NAME,
  getRequiredToolNames,
} from "../../../src/facade/langchain/cold-start/workflow-constants.js";

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

const TOOLS_DIR = path.resolve(
  import.meta.dirname,
  "../../../src/facade/langchain/cold-start/tools",
);

function readToolSource(toolFileName: string): string {
  return readFileSync(path.resolve(TOOLS_DIR, toolFileName), "utf8");
}

function extractDescriptionBlock(source: string): string {
  const match = source.match(/description:\s*([\s\S]*?)schema:/);
  return match?.[1]?.toLowerCase() ?? "";
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

      // ToolMessage должен содержать "show_plan"
      expect(source).toContain("call show_plan");
      // НЕ должен содержать старый routing
      expect(source).not.toMatch(/Now call confirm_plan(?! )/);

      // Description тоже должен быть правильным
      expect(source).toContain("call show_plan");
    });

    it("process_entity_batch → show_context (success) or ask_clarification (clarification)", () => {
      const source = readToolSource("process-entity-batch.tool.ts");

      // Success case: должен направлять на show_context
      expect(source).toContain("call show_context");
      // Clarification case: должен направлять на ask_clarification
      expect(source).toContain("call ask_clarification");

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
    const CONFIRM_TOOLS = [
      "confirm-plan.tool.ts",
      "confirm-context.tool.ts",
      "confirm-final.tool.ts",
    ];

    for (const toolFile of CONFIRM_TOOLS) {
      it(`${toolFile} imports and uses phaseGuard`, () => {
        const source = readToolSource(toolFile);

        // Должен импортировать phaseGuard
        expect(source).toContain("phaseGuard");
        // Должен импортировать из guards.js
        expect(source).toContain('from "./guards.js"');
        // Должен вызывать phaseGuard
        expect(source).toMatch(/phaseGuard\s*\(/);
      });
    }
  });

  /**
   * C04: PHASE_PREREQUISITES Complete
   *
   * Business rule: Каждая awaiting_* phase должна иметь prerequisite tool.
   */
  describe("C04: PHASE_PREREQUISITES covers all awaiting phases", () => {
    const AWAITING_PHASES = [
      PHASE.awaiting_plan_confirmation,
      PHASE.awaiting_clarification,
      PHASE.awaiting_context_confirmation,
      PHASE.awaiting_final_confirmation,
    ];

    for (const phase of AWAITING_PHASES) {
      it(`${phase} has prerequisite tool defined`, () => {
        const prereq = PHASE_PREREQUISITES[phase];

        expect(prereq).toBeDefined();
        expect(prereq.type).toBe("tool");

        if (prereq.type === "tool") {
          expect(prereq.name).toBeTruthy();
          // Должен быть валидным tool name
          expect(Object.values(TOOL_NAME)).toContain(prereq.name);
        }
      });
    }

    it("getRequiredToolNames returns tool names for awaiting phases", () => {
      const result = getRequiredToolNames(AWAITING_PHASES);

      expect(result).not.toBeNull();
      expect(result).toContain(TOOL_NAME.show_plan);
      expect(result).toContain(TOOL_NAME.show_context);
      expect(result).toContain(TOOL_NAME.show_final);
    });
  });

  /**
   * C05: Workflow Constants Consistency
   *
   * Business rule: TOOL_NAME должен содержать все tools из agent.
   */
  describe("C05: Workflow constants are complete", () => {
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

    it("PHASE_PREREQUISITES covers all phases", () => {
      const allPhases = Object.values(PHASE);

      for (const phase of allPhases) {
        expect(PHASE_PREREQUISITES).toHaveProperty(phase);
      }
    });
  });
});
