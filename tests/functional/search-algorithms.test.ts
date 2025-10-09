/**
 * 🎯 Бизнес-тесты для поисковых алгоритмов
 *
 * Тестируем качество поиска и ранжирования кандидатов
 * на реальных данных с реальными сценариями
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import {
  buildStrictConditions,
  buildFlexibleScoring,
} from "../../src/orcestrator/snippets-extractor.js";
import { loadTestData } from "../helpers/test-data-loader.js";
import type { QueryConfig } from "../../src/schemas-zod.js";
import { executeUpsertStory } from "../../src/upsert-story.js";

describe("Поисковые алгоритмы", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  describe("🎯 Поиск похожих разработчиков", () => {
    it("находит Frontend разработчиков с похожими навыками", async () => {
      // Загружаем разнообразные данные для реалистичного теста
      const testData = [
        loadTestData("USER_001"), // Angular + fintech + fr
        loadTestData("USER_002"), // Vue + travel + nl
        loadTestData("USER_003"), // React Native + mobility + es
        loadTestData("USER_015"), // React + energy + de
      ];

      for (const data of testData) {
        await executeUpsertStory(driver, data);
      }

      // Берем Angular разработчика как поисковый контекст из БД
      const searchContextId = testData[0].contexts[0]!.context_id;
      const searchContextResult = await session.executeRead((tx) =>
        tx.run("MATCH (c:Context {context_id: $id}) RETURN c", { id: searchContextId })
      );
      const searchContext = searchContextResult.records[0]!.get("c");
      
      // Добавляем context_id к объекту из БД
      searchContext.context_id = searchContextId;

      // Конфигурация поиска: Frontend + навыки + индустрия
      const config: QueryConfig = {
        strictPresets: [
          { field: "domains" }, // Обязательно Frontend
        ],
        flexiblePresets: [
          { field: "skills", weight: 60 }, // Навыки важнее
          { field: "industry", weight: 40 }, // Индустрия
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

      // Выполняем поиск
      const fullQuery = `
        MATCH (searchCtx:Context {context_id: $searchContextId})
        MATCH (candidateCtx:Context)
        WHERE candidateCtx.context_id <> $searchContextId
        WITH *, searchCtx AS requestedCurrentContext, candidateCtx AS dbCurrentContext
        ${whereClause ? `WHERE ${whereClause}` : ''}
        ${scoreClause}
        RETURN candidateCtx.context_id, candidateCtx.position,
               candidateCtx.industry, candidateCtx.country_code,
               candidateCtx.domains, candidateCtx.skills,
               compatibilityScore
        ORDER BY compatibilityScore DESC
        LIMIT 10
      `.trim();

      const result = await session.executeRead((tx) =>
        tx.run(fullQuery, {
          searchContextId: searchContext.context_id,
        })
      );

      // Проверяем качество поиска
      expect(result.records.length).toBeGreaterThan(0);

      // Анализируем результаты
      const candidates = result.records.map((record) => {
        const skills = record.get("candidateCtx.skills");
        return {
          id: record.get("candidateCtx.context_id"),
          position: record.get("candidateCtx.position"),
          industry: record.get("candidateCtx.industry"),
          country: record.get("candidateCtx.country_code"),
          domains: record.get("candidateCtx.domains"),
          skills: Array.isArray(skills) ? skills : [],
          score: record.get("compatibilityScore") || 0,
        };
      });

      // Все кандидаты должны иметь Frontend домен
      candidates.forEach((candidate) => {
        expect(candidate.domains).toContain("Frontend");
        expect(candidate.score).toBeGreaterThan(0);
      });

      // Проверяем ранжирование: скоры должны убывать
      const scores = candidates.map((c) => c.score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }

      // Логируем топ-3 кандидата для анализа
      console.log("🏆 Топ-3 кандидата:");
      candidates.slice(0, 3).forEach((candidate, index) => {
        console.log(
          `${index + 1}. ${candidate.position} | ${candidate.industry} | ${candidate.country} | Score: ${candidate.score}`
        );
        console.log(`   Skills: ${candidate.skills.join(", ")}`);
      });
    });

    it("ранжирует кандидатов по релевантности навыков", async () => {
      // Загружаем данные с разными навыками
      const testData = [
        loadTestData("USER_001"), // Angular + fintech
        loadTestData("USER_002"), // Vue + travel
        loadTestData("USER_015"), // React + energy
      ];

      for (const data of testData) {
        await executeUpsertStory(driver, data);
      }

      // Ищем по React навыку
      const searchContext = testData[2].contexts[1]!; // React контекст

      const config: QueryConfig = {
        strictPresets: [{ field: "domains" }],
        flexiblePresets: [
          { field: "skills", weight: 100 }, // Только навыки
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

      const fullQuery = `
        MATCH (searchCtx:Context {context_id: $searchContextId})
        MATCH (candidateCtx:Context)
        WHERE candidateCtx.context_id <> $searchContextId
        WITH *, searchCtx AS requestedCurrentContext, candidateCtx AS dbCurrentContext
        ${whereClause ? `WHERE ${whereClause}` : ''}
        ${scoreClause}
        RETURN candidateCtx.context_id, candidateCtx.skills, compatibilityScore
        ORDER BY compatibilityScore DESC
        LIMIT 5
      `.trim();

      const result = await session.executeRead((tx) =>
        tx.run(fullQuery, {
          searchContextId: searchContext.context_id,
        })
      );

      const candidates = result.records.map((record) => {
        const skills = record.get("candidateCtx.skills");
        return {
          skills: Array.isArray(skills) ? skills : [],
          score: record.get("compatibilityScore") || 0,
        };
      });

      // Проверяем что кандидаты с React получают более высокие скоры
      const reactCandidates = candidates.filter((c) =>
        c.skills.some((skill) => skill.toLowerCase().includes("react"))
      );

      const nonReactCandidates = candidates.filter(
        (c) => !c.skills.some((skill) => skill.toLowerCase().includes("react"))
      );

      if (reactCandidates.length > 0 && nonReactCandidates.length > 0) {
        const maxReactScore = Math.max(...reactCandidates.map((c) => c.score));
        const maxNonReactScore = Math.max(
          ...nonReactCandidates.map((c) => c.score)
        );

        expect(maxReactScore).toBeGreaterThan(maxNonReactScore);
      }

      console.log("🎯 Результаты ранжирования по навыкам:");
      candidates.forEach((candidate, index) => {
        console.log(
          `${index + 1}. Score: ${candidate.score} | Skills: ${candidate.skills.join(", ")}`
        );
      });
    });
  });
});
