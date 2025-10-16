import { describe, it, expect } from "vitest";
import {
  buildStrictConditions,
  buildFlexibleConditions,
} from "../../src/orcestrator/snippets-extractor.js";
import { PRESETS } from "../../src/generated/presets.generated.js";

describe("Field Snippets Unit Tests", () => {
  it("generates full strict and flexible clauses for BALANCED profile", () => {
    const config = PRESETS.BALANCED;
    const whereClause = buildStrictConditions(config.strictFields);
    const scoreClause = buildFlexibleConditions(config.flexibleFields);

    expect(whereClause).toBe(
      `dbContext.position = requestedContext.position AND
  all(d IN requestedContext.domains WHERE d IN dbContext.domains) AND
  all(s IN requestedContext.skills WHERE s.name IN dbContext.skills)`
    );

    expect(scoreClause).toBe(
      `WITH *, (
  CASE WHEN dbContext.industry = requestedContext.industry THEN 25 ELSE 0 END +
  CASE WHEN dbContext.country_code = requestedContext.country_code THEN 20 ELSE 0 END +
  CASE WHEN dbContext.city_name = requestedContext.city_name THEN 15 ELSE 0 END +
  CASE WHEN dbContext.work_type = requestedContext.work_type THEN 10 ELSE 0 END +
  CASE WHEN dbContext.company_size = requestedContext.company_size THEN 10 ELSE 0 END +
  CASE WHEN dbContext.team_size = requestedContext.team_size THEN 10 ELSE 0 END +
  CASE WHEN dbContext.birth_year = requestedContext.birth_year THEN 10 ELSE 0 END
) AS contextCompatibilityScore
WHERE contextCompatibilityScore > 0`
    );
  });

  it("includes skills in strict and weight in flexible for SKILL_FOCUSED profile", () => {
    const config = PRESETS.SKILL_FOCUSED;
    const whereClause = buildStrictConditions(config.strictFields);
    const scoreClause = buildFlexibleConditions(config.flexibleFields);

    expect(whereClause).toContain("position");
    expect(whereClause).toContain("skills");
    expect(scoreClause).toContain("THEN 30");
  });

  it("includes country and city in flexible for GEO_FOCUSED profile", () => {
    const config = PRESETS.GEO_FOCUSED;
    const whereClause = buildStrictConditions(config.strictFields);
    const scoreClause = buildFlexibleConditions(config.flexibleFields);

    expect(whereClause).toContain("position");
    expect(whereClause).toContain("domains");
    expect(scoreClause).toContain("country_code");
    expect(scoreClause).toContain("city_name");
    expect(scoreClause).toContain("THEN 35");
    expect(scoreClause).toContain("THEN 25");
  });

  it("generates clauses for FLEXIBLE profile", () => {
    const config = PRESETS.FLEXIBLE;
    const whereClause = buildStrictConditions(config.strictFields);
    const scoreClause = buildFlexibleConditions(config.flexibleFields);

    expect(whereClause).toContain("AND");
    expect(scoreClause).toContain("country_code");
    expect(scoreClause).toContain("THEN 40");
    expect(scoreClause).toContain("contextCompatibilityScore");
  });
});
