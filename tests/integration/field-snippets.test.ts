/**
 * 🧪 Интеграционные тесты для Field Snippets
 */

import { describe, it, expect, beforeAll } from "vitest";
import { buildQueryFromConfig } from "../../src/orcestrator/snippets-extractor.js";
import { PresetsManager } from "../../src/orcestrator/preset-manager.js";
import { join } from "path";

describe("Field Snippets Integration", () => {
  const searchCtx = "requestedContext";
  const candidateCtx = "dbCurrentContext";

  let presetsManager: PresetsManager;

  beforeAll(() => {
    const presetsPath = join(process.cwd(), "config", "presets.json");
    presetsManager = new PresetsManager(presetsPath);
    presetsManager.load();
  });

  describe("🎯 Интеграционные тесты", () => {
    it("должен генерировать полный запрос для BALANCED профиля", () => {
      const config = presetsManager.get("BALANCED");
      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      // Проверяем целостность запроса - все компоненты на месте
      expect(result.whereClause).toBe(
        `WHERE dbCurrentContext.position = requestedContext.position AND
  all(d IN requestedContext.domains WHERE d IN dbCurrentContext.domains) AND
  all(s IN [skill IN requestedContext.skills | skill.name] WHERE s IN dbCurrentContext.skills)`
      );

      expect(result.scoreClause).toBe(
        `WITH *, (
  CASE WHEN dbCurrentContext.industry = requestedContext.industry THEN 25 ELSE 0 END +
  CASE WHEN dbCurrentContext.country_code = requestedContext.country_code THEN 20 ELSE 0 END +
  CASE WHEN dbCurrentContext.city_name = requestedContext.city_name THEN 15 ELSE 0 END +
  CASE WHEN dbCurrentContext.work_type = requestedContext.work_type THEN 10 ELSE 0 END +
  CASE WHEN dbCurrentContext.company_size = requestedContext.company_size THEN 10 ELSE 0 END +
  CASE WHEN dbCurrentContext.team_size = requestedContext.team_size THEN 10 ELSE 0 END +
  CASE WHEN dbCurrentContext.birth_year = requestedContext.birth_year THEN 10 ELSE 0 END
) AS compatibilityScore
WHERE compatibilityScore > 0`
      );
    });

    it("должен генерировать полный запрос для SKILL_FOCUSED профиля", () => {
      const config = presetsManager.get("SKILL_FOCUSED");
      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toContain("position");
      expect(result.whereClause).toContain("domains");
      expect(result.whereClause).toContain("skills");
      expect(result.scoreClause).toContain("skills");
      expect(result.scoreClause).toContain("THEN 40");
    });

    it("должен генерировать полный запрос для GEO_FOCUSED профиля", () => {
      const config = presetsManager.get("GEO_FOCUSED");
      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toContain("position");
      expect(result.whereClause).toContain("domains");
      expect(result.scoreClause).toContain("country_code");
      expect(result.scoreClause).toContain("city_name");
      expect(result.scoreClause).toContain("THEN 35");
      expect(result.scoreClause).toContain("THEN 25");
    });

    it("должен генерировать полный запрос для FLEXIBLE профиля", () => {
      const config = presetsManager.get("FLEXIBLE");
      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toBe("");
      expect(result.scoreClause).toContain("position");
      expect(result.scoreClause).toContain("THEN 20");
      expect(result.scoreClause).toContain("compatibilityScore");
    });
  });
});
