/**
 * 🧪 Тесты для конфигурируемых сниппетов полей
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_SNIPPETS,
  buildQueryFromConfig,
} from "../../src/orcestrator/snippets-extractor.js";
import {
  validateSchema,
  QueryConfigSchema,
  QueryConfig,
} from "../../src/schemas-zod.js";

describe("Field Snippets", () => {
  const searchCtx = "requestedContext";
  const candidateCtx = "dbCurrentContext";

  describe("🧩 Отдельные сниппеты", () => {
    it("должен генерировать строгое условие для position", () => {
      const result = FIELD_SNIPPETS.position.strict(searchCtx, candidateCtx);
      expect(result).toContain(
        "dbCurrentContext.position = requestedContext.position"
      );
    });

    it("должен генерировать гибкое условие для position с весом", () => {
      const result = FIELD_SNIPPETS.position.flexible(
        searchCtx,
        candidateCtx,
        50
      );
      expect(result).toContain(
        "CASE WHEN dbCurrentContext.position = requestedContext.position"
      );
      expect(result).toContain("THEN 50");
    });

    it("должен генерировать строгое условие для domains", () => {
      const result = FIELD_SNIPPETS.domains.strict(searchCtx, candidateCtx);
      expect(result).toContain(
        "all(d IN requestedContext.domains WHERE d IN dbCurrentContext.domains)"
      );
    });

    it("должен генерировать гибкое условие для skills", () => {
      const result = FIELD_SNIPPETS.skills.flexible(
        searchCtx,
        candidateCtx,
        30
      );
      expect(result).toContain("CASE WHEN");
      expect(result).toContain(
        "size([s IN [skill IN requestedContext.skills | skill.name] WHERE s IN dbCurrentContext.skills])"
      );
      expect(result).toContain("THEN 30");
    });

    it("должен генерировать строгое условие для industry", () => {
      const result = FIELD_SNIPPETS.industry.strict(searchCtx, candidateCtx);
      expect(result).toContain(
        "dbCurrentContext.industry = requestedContext.industry"
      );
    });
  });

  describe("🔧 Конфигурируемый сборщик", () => {
    it("должен собирать запрос из строгих полей", () => {
      const config: QueryConfig = {
        strictPresets: [{ field: "position" }, { field: "domains" }],
        flexiblePresets: [],
      };

      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toContain("WHERE");
      expect(result.whereClause).toContain(
        "dbCurrentContext.position = requestedContext.position"
      );
      expect(result.whereClause).toContain(
        "all(d IN requestedContext.domains WHERE d IN dbCurrentContext.domains)"
      );
      expect(result.scoreClause).toBe("");
    });

    it("должен собирать запрос из гибких полей", () => {
      const config: QueryConfig = {
        strictPresets: [],
        flexiblePresets: [
          { field: "position", weight: 50 },
          { field: "skills", weight: 30 },
        ],
      };

      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toBe("");
      expect(result.scoreClause).toContain("WITH *, (");
      expect(result.scoreClause).toContain("THEN 50");
      expect(result.scoreClause).toContain("THEN 30");
    });

    it("должен собирать смешанный запрос", () => {
      const config: QueryConfig = {
        strictPresets: [{ field: "position" }],
        flexiblePresets: [
          { field: "skills", weight: 40 },
          { field: "industry", weight: 20 },
        ],
      };

      const result = buildQueryFromConfig(
        config.flexiblePresets,
        config.strictPresets.map((s) => s.field),
        searchCtx,
        candidateCtx
      );

      expect(result.whereClause).toContain("WHERE");
      expect(result.whereClause).toContain(
        "dbCurrentContext.position = requestedContext.position"
      );
      expect(result.scoreClause).toContain("WITH *, (");
      expect(result.scoreClause).toContain("compatibilityScore");
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
