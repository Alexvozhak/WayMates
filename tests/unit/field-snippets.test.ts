/**
 * 🧪 Тесты для конфигурируемых сниппетов полей
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_SNIPPETS,
  buildStrictConditions,
  buildFlexibleScoring,
} from "../../src/orcestrator/snippets-extractor.js";
import {
  validateSchema,
  QueryConfigSchema,
  QueryConfig,
} from "../../src/schemas-zod.js";

describe("Field Snippets", () => {
  describe("🧩 Отдельные сниппеты", () => {
    it("должен генерировать строгое условие для position", () => {
      const result = FIELD_SNIPPETS.position.strict(
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      expect(result).toContain(
        "dbCurrentContext.position = requestedCurrentContext.position"
      );
    });

    it("должен генерировать гибкое условие для position с весом", () => {
      const weight = 50;
      const result = FIELD_SNIPPETS.position.flexible(
        "requestedCurrentContext",
        "dbCurrentContext",
        weight
      );
      const expected = `CASE WHEN dbCurrentContext.position = requestedCurrentContext.position THEN ${weight} ELSE 0 END`;
      expect(result).toBe(expected);
    });

    it("должен генерировать строгое условие для domains", () => {
      const result = FIELD_SNIPPETS.domains.strict(
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      expect(result).toContain(
        "all(d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains)"
      );
    });

    it("должен генерировать гибкое условие для skills", () => {
      const weight = 30;
      const result = FIELD_SNIPPETS.skills.flexible(
        "requestedCurrentContext",
        "dbCurrentContext",
        weight
      );
      const expected = `CASE WHEN size([s IN requestedCurrentContext.skills WHERE s.name IN dbCurrentContext.skills]) > 0 
      THEN ${weight} * (toFloat(size([s IN requestedCurrentContext.skills WHERE s.name IN dbCurrentContext.skills])) / size(requestedCurrentContext.skills)) 
      ELSE 0 END`;
      expect(result).toBe(expected);
    });

    it("должен генерировать строгое условие для industry", () => {
      const result = FIELD_SNIPPETS.industry.strict(
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      expect(result).toContain(
        "dbCurrentContext.industry = requestedCurrentContext.industry"
      );
    });
  });

  describe("🔧 Конфигурируемый сборщик", () => {
    it("должен собирать запрос из строгих полей", () => {
      const config: QueryConfig = {
        strictPresets: [{ field: "position" }, { field: "domains" }],
        flexiblePresets: [],
      };

      const whereClause = buildStrictConditions(
        config.strictPresets.map((s) => s.field),
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      const scoreClause = buildFlexibleScoring(
        config.flexiblePresets,
        "requestedCurrentContext",
        "dbCurrentContext"
      );

      expect(whereClause).toContain("AND");
      expect(whereClause).toContain(
        "dbCurrentContext.position = requestedCurrentContext.position"
      );
      expect(whereClause).toContain(
        "all(d IN requestedCurrentContext.domains WHERE d IN dbCurrentContext.domains)"
      );
      expect(scoreClause).toBe("WITH *, 0 AS compatibilityScore");
    });

    it("должен собирать запрос из гибких полей", () => {
      const positionWeight = 50;
      const skillsWeight = 30;

      const config: QueryConfig = {
        strictPresets: [],
        flexiblePresets: [
          { field: "position", weight: positionWeight },
          { field: "skills", weight: skillsWeight },
        ],
      };

      const whereClause = buildStrictConditions(
        config.strictPresets.map((s) => s.field),
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      const scoreClause = buildFlexibleScoring(
        config.flexiblePresets,
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      expect(whereClause).toBe("");
      expect(scoreClause).toContain("WITH *, (");
      expect(scoreClause).toContain(`THEN ${positionWeight}`);
      expect(scoreClause).toContain(`THEN ${skillsWeight}`);
    });

    it("должен собирать смешанный запрос", () => {
      const config: QueryConfig = {
        strictPresets: [{ field: "position" }, { field: "domains" }],
        flexiblePresets: [
          { field: "skills", weight: 40 },
          { field: "industry", weight: 20 },
        ],
      };

      const whereClause = buildStrictConditions(
        config.strictPresets.map((s) => s.field),
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      const scoreClause = buildFlexibleScoring(
        config.flexiblePresets,
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      expect(whereClause).toContain(
        "dbCurrentContext.position = requestedCurrentContext.position"
      );
      expect(whereClause).toContain("AND");
      expect(scoreClause).toContain("WITH *, (");
      expect(scoreClause).toContain("compatibilityScore");
    });
  });

  describe("✅ Валидация конфигурации", () => {
    it("должен валидировать корректную конфигурацию", () => {
      const config = {
        strictPresets: [{ field: "position" }],
        flexiblePresets: [{ field: "skills", weight: 100 }],
      };

      expect(() =>
        validateSchema(config, QueryConfigSchema, "QueryConfig")
      ).not.toThrow();
      const validatedConfig = validateSchema(
        config,
        QueryConfigSchema,
        "QueryConfig"
      );
      expect(validatedConfig).toEqual(config);
    });

    it("должен находить ошибки в некорректной конфигурации", () => {
      const config = {
        strictPresets: [{ field: "unknown_field", mode: "strict" }],
        flexiblePresets: [{ field: "skills", weight: 50 }],
      };

      expect(() =>
        validateSchema(config, QueryConfigSchema, "QueryConfig")
      ).toThrow();
    });

    it("должен предупреждать о превышении весов", () => {
      const config = {
        strictPresets: [],
        flexiblePresets: [
          { field: "skills", weight: 60 },
          { field: "domains", weight: 50 },
        ],
      };

      expect(() =>
        validateSchema(config, QueryConfigSchema, "QueryConfig")
      ).toThrow("Total weight of flexible fields must equal 100");
    });

    it("должен валидировать типы полей", () => {
      const config = {
        strictPresets: [{ field: "position", mode: "strict" }],
        flexiblePresets: [{ field: "skills", weight: "invalid" }],
      };

      expect(() =>
        validateSchema(config, QueryConfigSchema, "QueryConfig")
      ).toThrow();
    });

    it("должен валидировать диапазон весов", () => {
      const config = {
        strictPresets: [],
        flexiblePresets: [{ field: "skills", weight: 150 }],
      };

      expect(() =>
        validateSchema(config, QueryConfigSchema, "QueryConfig")
      ).toThrow();
    });
  });
});
