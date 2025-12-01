import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PHASE } from "../../../src/facade/langchain/upsert-context/types.js";
import { TOOL_NAME } from "../../../src/facade/langchain/upsert-context/workflow-constants.js";

import type { ToolName } from "../../../src/facade/langchain/upsert-context/workflow-constants.js";

/**
 * Contract Tests for UpsertContext Agent
 *
 * Цель: Проверить internal contracts БЕЗ LLM calls.
 * Время выполнения: ~50ms (статический анализ)
 *
 * Workflow: extract_context → show_context → confirm_context / edit_context
 */

const TOOLS_DIR = path.resolve(import.meta.dirname, "../../../src/facade/langchain/upsert-context/tools");

function readToolSource(toolFileName: string): string {
  return readFileSync(path.resolve(TOOLS_DIR, toolFileName), "utf8");
}

function extractDescriptionBlock(source: string): string {
  const match = source.match(/description:\s*([\s\S]*?)schema:/);
  return match?.[1]?.toLowerCase() ?? "";
}

describe("UpsertContext Contract Tests", () => {
  /**
   * C01: ToolMessage Routing Consistency
   *
   * Business rule: Каждый tool должен направлять на ПРАВИЛЬНЫЙ следующий tool.
   */
  describe("C01: ToolMessage routing consistency", () => {
    it("extract_context → show_context", () => {
      const source = readToolSource("extract-context.tool.ts");

      expect(source).toContain("show_context");
      expect(source).not.toMatch(/call confirm_context/);
    });

    it("edit_context → show_context", () => {
      const source = readToolSource("edit-context.tool.ts");

      expect(source).toContain("show_context");
      expect(source).not.toMatch(/call confirm_context/);
    });

    it("show_context → confirm_context or edit_context", () => {
      const source = readToolSource("show-context.tool.ts");

      expect(source).toContain("confirm_context");
      expect(source).toContain("edit_context");
    });
  });

  /**
   * C02: Tool Descriptions Match Workflow
   *
   * Business rule: Description каждого tool должен соответствовать workflow.
   */
  describe("C02: Tool descriptions match workflow", () => {
    it("extract_context description mentions show_context", () => {
      const source = readToolSource("extract-context.tool.ts");
      const descriptionBlock = extractDescriptionBlock(source);

      expect(descriptionBlock).toContain("show_context");
    });

    it("edit_context description mentions corrections", () => {
      const source = readToolSource("edit-context.tool.ts");
      const descriptionBlock = extractDescriptionBlock(source);

      expect(descriptionBlock).toContain("correction");
    });
  });

  /**
   * C03: Phase Guards Exist
   *
   * Business rule: ВСЕ tools используют phaseGuard для defensive design.
   */
  describe("C03: Phase guards exist", () => {
    const GUARDED_TOOLS = [
      "extract-context.tool.ts",
      "show-context.tool.ts",
      "confirm-context.tool.ts",
      "edit-context.tool.ts",
    ];

    for (const toolFile of GUARDED_TOOLS) {
      it(`${toolFile} imports and uses phaseGuard`, () => {
        const source = readToolSource(toolFile);

        expect(source).toContain("phaseGuard");
        expect(source).toContain('from "../../shared-tools/guards.js"');
        expect(source).toMatch(/phaseGuard\s*\(/);
      });
    }
  });

  /**
   * C05: Workflow Constants Consistency
   *
   * Business rule: TOOL_NAME и PHASE должны быть complete.
   */
  describe("C05: Workflow constants are complete", () => {
    const EXPECTED_TOOLS: ToolName[] = ["extract_context", "show_context", "confirm_context", "edit_context"];

    it("TOOL_NAME contains all workflow tools", () => {
      for (const toolName of EXPECTED_TOOLS) {
        expect(TOOL_NAME).toHaveProperty(toolName);
        expect(TOOL_NAME[toolName]).toBe(toolName);
      }
    });

    it("PHASE enum has all phases", () => {
      const expectedPhases = ["extracting", "awaiting_confirmation", "saved", "failed"];

      for (const phase of expectedPhases) {
        expect(PHASE).toHaveProperty(phase);
      }
    });
  });
});
