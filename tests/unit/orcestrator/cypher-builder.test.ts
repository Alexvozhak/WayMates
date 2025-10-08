import { describe, expect, test } from "vitest";
import { join } from "path";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import {
  buildQueryFromConfig,
} from "../../../src/orcestrator/snippets-extractor.js";
import {
  buildCurrentToTargetQuery,
  buildTargetTransitionQuery,
} from "../../../src/orcestrator/cypher-builder.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("cypher-builder", () => {
  test("buildCurrentToTargetQuery stitches strict and flexible clauses", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const { whereClause, scoreClause } = buildQueryFromConfig(
      balanced.flexiblePresets,
      balanced.strictPresets.map((preset) => preset.field),
      "requestedCurrentContext",
      "dbCurrentContext"
    );

    const query = buildCurrentToTargetQuery(
      whereClause,
      scoreClause,
      "requestedCurrentContext",
      "dbCurrentContext"
    );

    expect(query).toContain("WITH $currentContext AS requestedCurrentContext");
    expect(query).toContain(
      "dbCurrentContext.position = requestedCurrentContext.position"
    );
    expect(query).toContain(
      "all(d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains)"
    );
    expect(query).toContain("compatibilityScore AS currentContextCompatibilityScore");
  });

  test("buildCurrentToTargetQuery keeps guard clause when filters absent", () => {
    const query = buildCurrentToTargetQuery("", "");
    expect(query).toContain("requestedCurrentContext IS NOT NULL");
    expect(query).not.toMatch(/WHERE\s+AND/);
  });

  test("buildTargetTransitionQuery excludes identical contexts", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const { whereClause, scoreClause } = buildQueryFromConfig(
      balanced.flexiblePresets,
      balanced.strictPresets.map((preset) => preset.field),
      "requestedTargetContext",
      "dbTargetContext"
    );

    const query = buildTargetTransitionQuery(
      whereClause,
      scoreClause,
      "requestedTargetContext",
      "dbTargetContext"
    );

    expect(query).toContain("$targetContext AS requestedTargetContext");
    expect(query).toContain(
      "dbTargetContext.context_id <> dbCurrentContext.context_id"
    );
    expect(query).toContain("compatibilityScore AS targetContextCompatibilityScore");
  });
});
