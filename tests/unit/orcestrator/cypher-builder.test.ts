import { describe, expect, test } from "vitest";
import { join } from "path";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import {
  buildStrictConditions,
  buildFlexibleScoring,
} from "../../../src/orcestrator/snippets-extractor.js";
import {
  buildCurrentContextQuery,
  buildTargetTransitionQuery,
} from "../../../src/orcestrator/cypher-builder.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("cypher-builder", () => {
  test("buildCurrentContextQuery stitches strict and flexible clauses", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const whereClause = buildStrictConditions(
      balanced.strictPresets.map((preset) => preset.field),
      "requestedCurrentContext",
      "dbCurrentContext"
    );
    const scoreClause = buildFlexibleScoring(
      balanced.flexiblePresets,
      "requestedCurrentContext",
      "dbCurrentContext"
    );

    const query = buildCurrentContextQuery(whereClause, scoreClause);

    expect(query).toContain("$currentContext AS requestedCurrentContext");
    expect(query).toContain(
      "MATCH\n  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)"
    );
    expect(query).toContain(
      "compatibilityScore AS currentContextCompatibilityScore"
    );
  });

  test("buildTargetTransitionQuery excludes identical contexts", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const whereClause = buildStrictConditions(
      balanced.strictPresets.map((preset) => preset.field),
      "requestedTargetContext",
      "dbTargetContext"
    );
    const scoreClause = buildFlexibleScoring(
      balanced.flexiblePresets,
      "requestedTargetContext",
      "dbTargetContext"
    );

    const query = buildTargetTransitionQuery(whereClause, scoreClause);

    expect(query).toContain("$targetContext AS requestedTargetContext");
    expect(query).toContain(
      "MATCH\n  (dbTargetUser:User)-[:HAS_CONTEXT]->(dbTargetContext:Context)"
    );
    expect(query).toContain(
      "compatibilityScore AS targetContextCompatibilityScore"
    );
  });
});
