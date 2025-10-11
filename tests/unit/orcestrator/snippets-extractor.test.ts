import { describe, expect, test } from "vitest";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import {
  FIELD_SNIPPETS,
  buildStrictConditions,
  buildFlexibleConditions,
} from "../../../src/orcestrator/snippets-extractor.js";

const PRESETS_PATH = require("path").join(process.cwd(), "config", "presets.json");

describe("snippets-extractor", () => {
  test("buildStrictConditions and buildFlexibleScoring compose filters and scoring", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");

    const whereClause = buildStrictConditions(balanced.strictFields);
    const scoreClause = buildFlexibleConditions(balanced.flexibleFields);

    expect(whereClause).toContain("dbContext.position = requestedContext.position");
    expect(whereClause).toContain("all(d IN requestedContext.domains WHERE d IN dbContext.domains)");
    expect(scoreClause).toContain("AS contextCompatibilityScore");
  });

  test("field snippets expose strict and flexible builders", () => {
    const snippet = FIELD_SNIPPETS.position;
    const strict = snippet.strict();
    const flexible = snippet.flexible(10);

    expect(strict).toContain(
      "dbContext.position = requestedContext.position"
    );
    expect(flexible).toContain("THEN 10");
  });
});
