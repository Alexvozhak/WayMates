import { describe, expect, test } from "vitest";
import { join } from "path";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import {
  FIELD_SNIPPETS,
  buildQueryFromConfig,
} from "../../../src/orcestrator/snippets-extractor.js";
import {
  processResults,
  FALLBACK_SELECTIVITY,
  buildExplainQuery,
} from "../../../src/orcestrator/selectivity-profiler.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("snippets-extractor", () => {
  test("buildQueryFromConfig composes strict filters and scoring", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const { whereClause, scoreClause } = buildQueryFromConfig(
      balanced.flexiblePresets,
      balanced.strictPresets.map((preset) => preset.field),
      "requestedCurrentContext",
      "dbCurrentContext"
    );

    expect(whereClause).toContain("WHERE");
    expect(whereClause).toContain(
      "dbCurrentContext.position = requestedCurrentContext.position"
    );
    expect(scoreClause).toContain("WITH *, (");
    expect(scoreClause).toContain("compatibilityScore");
  });

  test("buildExplainQuery resolves dynamic snippets", () => {
    const positionQuery = buildExplainQuery("position", "Senior");
    expect(positionQuery).toContain("MATCH (c:Context {position: $value})");

    const domainsQuery = buildExplainQuery("domains", ["Frontend"]);
    expect(domainsQuery).toContain("ANY(d IN $value WHERE d IN c.domains)");
  });

  test("buildExplainQuery rejects unknown fields", () => {
    expect(() => buildExplainQuery("unknown" as any)).toThrow(
      "Unknown field"
    );
  });

  test("processResults keeps fulfilled estimates and applies fallback", () => {
    const results = processResults(
      [
        { status: "fulfilled", value: 12 },
        { status: "rejected", reason: new Error("boom") },
      ] as const,
      ["position", "domains"]
    );

    expect(results).toEqual([
      { field: "position", estimatedRows: 12 },
      { field: "domains", estimatedRows: FALLBACK_SELECTIVITY },
    ]);
  });

  test("field snippets expose strict and flexible builders", () => {
    const snippet = FIELD_SNIPPETS.position;
    const strict = snippet.strict("requested", "candidate");
    const flexible = snippet.flexible("requested", "candidate", 10);

    expect(strict).toContain("candidate.position = requested.position");
    expect(flexible).toContain("THEN 10");
  });
});
