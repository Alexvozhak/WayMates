import { describe, expect, test } from "vitest";
import { join } from "path";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import {
  buildStrictConditions,
  buildFlexibleConditions,
} from "../../../src/orcestrator/snippets-extractor.js";
import { buildContextQuery } from "../../../src/orcestrator/cypher-builder.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("cypher-builder", () => {
  test("buildContextQuery stitches strict and flexible clauses for current context", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const whereClause = buildStrictConditions(balanced.strictFields);
    const scoreClause = buildFlexibleConditions(balanced.flexibleFields);

    const query = buildContextQuery("all", whereClause, scoreClause, 10);

    expect(query).toContain(
      "MATCH\n  (dbUser:User)-[:HAS_CONTEXT]->(dbContext:Context)"
    );
    expect(query).toContain(") AS contextCompatibilityScore");
    expect(query).toContain("AND dbUser <> dbCurrentUser");
  });

  test("buildContextQuery stitches strict and flexible clauses for target context", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const whereClause = buildStrictConditions(balanced.strictFields);
    const scoreClause = buildFlexibleConditions(balanced.flexibleFields);

    const query = buildContextQuery("filtered", whereClause, scoreClause, 10);

    expect(query).toContain(
      "MATCH\n  (dbUser:User)-[:HAS_CONTEXT]->(dbContext:Context)"
    );
    expect(query).toContain(") AS contextCompatibilityScore");
    expect(query).toContain("AND dbUser <> dbCurrentUser");
  });
});
