/**
 * 🧪 Интеграционные тесты для Field Snippets
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  buildStrictConditions,
  buildFlexibleConditions,
} from "../../src/orcestrator/snippets-extractor.js";
import { PresetsManager } from "../../src/orcestrator/preset-manager.js";
import { join } from "path";

describe("Field Snippets Integration", () => {
  let presetsManager: PresetsManager;

  beforeAll(() => {
    const presetsPath = join(process.cwd(), "config", "presets.json");
    presetsManager = new PresetsManager(presetsPath);
    presetsManager.load();
  });

  describe("🎯 Интеграционные тесты", () => {
    it("должен генерировать полный запрос для BALANCED профиля", () => {
      const config = presetsManager.get("BALANCED");
      const whereClause = buildStrictConditions(config.strictFields);
      const scoreClause = buildFlexibleConditions(config.flexibleFields);
      // const result = { whereClause, scoreClause };

      // Проверяем целостность запроса - все компоненты на месте
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

    it("должен генерировать полный запрос для SKILL_FOCUSED профиля", () => {
      const config = presetsManager.get("SKILL_FOCUSED");
      const whereClause = buildStrictConditions(config.strictFields);
      const scoreClause = buildFlexibleConditions(config.flexibleFields);
      // const result = { whereClause, scoreClause };

      expect(whereClause).toContain("position");
      expect(whereClause).toContain("skills");
      // Flexible scoring starts with domains weight 30
      expect(scoreClause).toContain("THEN 30");
    });

    it("должен генерировать полный запрос для GEO_FOCUSED профиля", () => {
      const config = presetsManager.get("GEO_FOCUSED");
      const whereClause = buildStrictConditions(config.strictFields);
      const scoreClause = buildFlexibleConditions(config.flexibleFields);
      // const result = { whereClause, scoreClause };

      expect(whereClause).toContain("position");
      expect(whereClause).toContain("domains");
      expect(scoreClause).toContain("country_code");
      expect(scoreClause).toContain("city_name");
      expect(scoreClause).toContain("THEN 35");
      expect(scoreClause).toContain("THEN 25");
    });

    it("должен генерировать полный запрос для FLEXIBLE профиля", () => {
      const config = presetsManager.get("FLEXIBLE");
      const whereClause = buildStrictConditions(config.strictFields);
      const scoreClause = buildFlexibleConditions(config.flexibleFields);
      // const result = { whereClause, scoreClause };

      expect(whereClause).toContain("AND");
      expect(scoreClause).toContain("country_code");
      expect(scoreClause).toContain("THEN 40");
      expect(scoreClause).toContain("contextCompatibilityScore");
    });
  });
});
