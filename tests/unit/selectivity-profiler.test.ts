import { describe, it, expect, vi } from "vitest";
import {
  FALLBACK_SELECTIVITY,
  buildExplainQuery,
  processResults,
} from "../../src/orcestrator/selectivity-profiler.js";
import { ContextField } from "../../src/schemas-zod.js";

describe("SelectivityProfiler Unit Tests", () => {
  describe("buildExplainQuery", () => {
    it("должен генерировать правильный EXPLAIN запрос для position", () => {
      const query = buildExplainQuery("position", "Senior");
      expect(query).toContain("EXPLAIN");
      expect(query).toContain("MATCH (c:Context {position:");
      expect(query).toContain("RETURN count(c)");
    });

    it("должен генерировать правильный EXPLAIN запрос для domains", () => {
      const query = buildExplainQuery("domains", ["backend"]);
      expect(query).toContain("EXPLAIN");
      expect(query).toContain("WHERE ANY(d IN $value WHERE d IN c.domains)");
      expect(query).toContain("RETURN count(c)");
    });

    it("должен генерировать правильный EXPLAIN запрос для skills", () => {
      const query = buildExplainQuery("skills", [
        { name: "JS", category: "language" },
      ]);
      expect(query).toContain("EXPLAIN");
      expect(query).toContain(
        "WHERE ANY(s IN [skill IN $value | skill.name] WHERE s IN c.skills)"
      );
      expect(query).toContain("RETURN count(c)");
    });

    it("должен кидать исключение для неизвестных полей", () => {
      expect(() => {
        buildExplainQuery("unknown_field" as any);
      }).toThrow("Unknown field 'unknown_field'. Available:");
    });
  });

  describe("processResults", () => {
    it("должен обрабатывать успешные результаты", () => {
      const results = [
        { status: "fulfilled" as const, value: 100 },
        { status: "fulfilled" as const, value: 200 },
      ];
      const fields: ContextField[] = ["position", "industry"];

      const processed = processResults(results, fields);

      expect(processed).toEqual([
        { field: "position", estimatedRows: 100 },
        { field: "industry", estimatedRows: 200 },
      ]);
    });

    it("должен обрабатывать отклоненные промисы с фоллбэком", () => {
      const results = [
        { status: "rejected" as const, reason: new Error("Connection failed") },
        { status: "fulfilled" as const, value: 200 },
      ];
      const fields: ContextField[] = ["position", "industry"];

      const processed = processResults(results, fields);

      expect(processed).toEqual([
        { field: "position", estimatedRows: FALLBACK_SELECTIVITY }, // фоллбэк
        { field: "industry", estimatedRows: 200 },
      ]);
    });
  });
});
