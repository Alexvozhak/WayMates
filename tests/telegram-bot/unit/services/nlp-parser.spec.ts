import { describe, expect, it } from "vitest";

import {
  parseTargetQuery,
  parseAdhocQuery,
  parseCurrentQuery,
  parseGoalQuery,
} from "../../../../src/telegram-bot/services/nlp-parser.js";

const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_API_BASE;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required for nlp-parser tests");
}

/**
 * Unit-тесты для NLP Parser (real LLM, не mock).
 *
 * Бизнес-критичность:
 * - NLP парсинг — точка входа всех пользовательских запросов
 * - Ошибка парсинга = пользователь не найдёт нужную информацию
 * - Тестируем реальные сценарии на русском и английском
 */
describe("nlp-parser", () => {
  describe("parseTargetQuery", () => {
    /**
     * Бизнес-сценарий: Пользователь ищет позицию в конкретной стране.
     * LLM должен распознать position + country с правильным режимом "desired".
     */
    it("NLP-T1: extracts position and country from Russian query", async () => {
      const result = await parseTargetQuery(apiKey, "Хочу стать Senior Backend Developer в США", baseUrl);

      expect(result.targetContext).toBeDefined();
      expect(result.targetContext?.position).toMatchObject({ mode: "desired" });
      expect(result.targetContext?.countries).toMatchObject({ mode: "desired" });
    });

    /**
     * Бизнес-сценарий: Пользователь ищет с исключением — "кроме лэйоффов".
     * LLM должен распознать excludedCreationReasons.
     */
    it("NLP-T2: extracts exclusion from 'except layoffs' phrase", async () => {
      const result = await parseTargetQuery(apiKey, "Найди Data Engineer кроме уволенных", baseUrl);

      expect(result.targetContext).toBeDefined();
      expect(result.targetContext?.position).toBeDefined();

      // Главное — распознал исключение
      expect(result.excludedCreationReasons).toBeDefined();
      expect(Array.isArray(result.excludedCreationReasons)).toBe(true);
      // "fired" или "layoff" должны быть в исключениях
      expect(result.excludedCreationReasons?.length).toBeGreaterThan(0);
    });

    /**
     * Бизнес-сценарий: Пользователь указывает временной фильтр.
     * "за последний год" → recencyThresholdMonths: 12
     */
    it("NLP-T3: extracts recency threshold from 'last year' phrase", async () => {
      const result = await parseTargetQuery(apiKey, "Product Manager за последний год", baseUrl);

      expect(result.targetContext).toBeDefined();
      expect(result.recencyThresholdMonths).toBeDefined();
      expect(typeof result.recencyThresholdMonths).toBe("number");
      // Примерно 12 месяцев (+/- погрешность LLM)
      expect(result.recencyThresholdMonths).toBeGreaterThanOrEqual(10);
      expect(result.recencyThresholdMonths).toBeLessThanOrEqual(14);
    });

    /**
     * Бизнес-сценарий: Пользователь просит "топ 5 результатов".
     * LLM должен извлечь limit.
     */
    it("NLP-T4: extracts limit from 'top N' phrase", async () => {
      const result = await parseTargetQuery(apiKey, "top 5 Frontend developers in Germany", baseUrl);

      expect(result.targetContext).toBeDefined();
      expect(result.limit).toBe(5);
    });

    /**
     * Бизнес-сценарий: Пользователь указывает навыки.
     * "Python и SQL" → skills с mode: "desired"
     */
    it("NLP-T5: extracts skills from query", async () => {
      const result = await parseTargetQuery(apiKey, "Developer with Python and SQL skills", baseUrl);

      expect(result.targetContext).toBeDefined();
      expect(result.targetContext?.skills).toBeDefined();
      expect(result.targetContext?.skills?.mode).toBe("desired");

      const skillValues = result.targetContext?.skills?.values?.map((v) => v.toLowerCase()) ?? [];
      expect(skillValues.some((v) => v.includes("python"))).toBe(true);
      expect(skillValues.some((v) => v.includes("sql"))).toBe(true);
    });

    /**
     * Бизнес-сценарий: Пользователь исключает навыки — "без Java".
     * LLM должен использовать mode: "undesired".
     */
    it("NLP-T6: extracts undesired skills from exclusion phrase", async () => {
      const result = await parseTargetQuery(apiKey, "Backend developer without Java, except Java", baseUrl);

      expect(result.targetContext).toBeDefined();
      // Строгая проверка: LLM должен распознать исключение навыка
      expect(result.targetContext?.skills?.mode).toBe("undesired");
      const skillValues = result.targetContext?.skills?.values?.map((v) => v.toLowerCase()) ?? [];
      expect(skillValues.some((v) => v.includes("java"))).toBe(true);
    });

    /**
     * Бизнес-сценарий: Пустой или нераспознаваемый запрос.
     * Должен бросить NlpParseError, а не вернуть пустой результат.
     */
    it("NLP-T7: throws on empty/unrecognizable query", async () => {
      // Проверяем что бросается ошибка (не возвращается пустой результат)
      await expect(parseTargetQuery(apiKey, "hello", baseUrl)).rejects.toThrow();
    });
  });

  describe("parseAdhocQuery", () => {
    /**
     * Бизнес-сценарий: Пользователь описывает себя для adhoc-поиска.
     * LLM должен извлечь referenceContext с позицией и навыками.
     */
    it("NLP-A1: extracts reference context from user description", async () => {
      const result = await parseAdhocQuery(
        apiKey,
        "Я Senior Python Developer с 5 годами опыта в финтехе, знаю FastAPI и PostgreSQL",
        baseUrl,
      );

      expect(result.referenceContext).toBeDefined();
      expect(result.referenceContext?.position).toBeDefined();
      expect(result.referenceContext?.skills?.length).toBeGreaterThan(0);
      expect(result.referenceContext?.domains?.length).toBeGreaterThan(0);
    });

    /**
     * Бизнес-сценарий: Пользователь указывает страну и город.
     * LLM должен извлечь countryCode (ISO) и cityName.
     */
    it("NLP-A2: extracts location from description", async () => {
      const result = await parseAdhocQuery(apiKey, "Frontend developer from Moscow, Russia", baseUrl);

      expect(result.referenceContext).toBeDefined();

      // Строгая проверка: LLM должен извлечь хотя бы страну или город
      const hasLocation = result.referenceContext?.countryCode || result.referenceContext?.cityName;
      expect(hasLocation).toBeDefined();

      // Если есть страна — проверяем что это Россия
      if (result.referenceContext?.countryCode) {
        expect(result.referenceContext.countryCode).toBe("RU");
      }

      // Если есть город — проверяем что это Москва
      if (result.referenceContext?.cityName) {
        expect(result.referenceContext.cityName.toLowerCase()).toContain("moscow");
      }
    });

    /**
     * Бизнес-сценарий: Пустое описание — должен бросить ошибку.
     */
    it("NLP-A3: throws on empty description", async () => {
      // "hello" достаточно абстрактно чтобы LLM не смог извлечь карьерную информацию
      await expect(parseAdhocQuery(apiKey, "hello", baseUrl)).rejects.toThrow();
    });
  });

  describe("parseCurrentQuery", () => {
    /**
     * Бизнес-сценарий: Пользователь хочет поиск по своему текущему контексту,
     * но исключить определённые поля из сравнения.
     */
    it("NLP-C1: extracts excluded fields from query", { timeout: 90_000 }, async () => {
      const result = await parseCurrentQuery(apiKey, "Find similar careers, ignore salary", baseUrl);

      // Строгая проверка: LLM должен извлечь excludedContextFields
      expect(result.excludedContextFields).toBeDefined();
      expect(result.excludedContextFields?.length).toBeGreaterThan(0);
    });

    /**
     * Бизнес-сценарий: Пользователь хочет топ-10 результатов за последние 2 года.
     */
    it("NLP-C2: extracts limit and recency from query", async () => {
      const result = await parseCurrentQuery(apiKey, "Show me top 10 similar careers from last 2 years", baseUrl);

      expect(result.limit).toBe(10);
      expect(result.recencyThresholdMonths).toBeDefined();
      // 2 года = ~24 месяца
      expect(result.recencyThresholdMonths).toBeGreaterThanOrEqual(20);
      expect(result.recencyThresholdMonths).toBeLessThanOrEqual(28);
    });

    /**
     * Бизнес-сценарий: Минимальный запрос без фильтров — не должен падать.
     */
    it("NLP-C3: handles minimal query without filters", async () => {
      const result = await parseCurrentQuery(apiKey, "Find similar careers", baseUrl);

      // Строгая проверка: результат должен быть пустым объектом (без фильтров)
      expect(result).toBeDefined();
      expect(result.excludedContextFields).toBeUndefined();
      expect(result.excludedCreationReasons).toBeUndefined();
      expect(result.limit).toBeUndefined();
      expect(result.recencyThresholdMonths).toBeUndefined();
    });
  });

  describe("parseGoalQuery", () => {
    /**
     * Бизнес-сценарий: Пользователь устанавливает карьерную цель.
     * LLM должен извлечь targetContext с position/domains.
     */
    it("NLP-G1: extracts goal with position and domain", async () => {
      const result = await parseGoalQuery(apiKey, "Хочу стать CTO в AI стартапе", baseUrl);

      expect(result).toBeDefined();
      expect(result.position?.mode).toBe("desired");
      expect(result.position?.values?.length).toBeGreaterThan(0);
      expect(result.domains?.mode).toBe("desired");
      expect(result.domains?.values?.length).toBeGreaterThan(0);
    });

    /**
     * Бизнес-сценарий: Цель с конкретными навыками.
     */
    it("NLP-G2: extracts goal with skills", async () => {
      const result = await parseGoalQuery(apiKey, "Want to work with Kubernetes and Terraform", baseUrl);

      expect(result).toBeDefined();
      expect(result.skills?.mode).toBe("desired");
      expect(result.skills?.values?.length).toBeGreaterThanOrEqual(2);
    });

    /**
     * Бизнес-сценарий: Цель с географией.
     */
    it("NLP-G3: extracts goal with country", async () => {
      const result = await parseGoalQuery(apiKey, "Want to relocate to Canada as DevOps engineer", baseUrl);

      expect(result).toBeDefined();
      expect(result.countries?.mode).toBe("desired");
      expect(result.countries?.values?.length).toBeGreaterThan(0);
    });

    /**
     * Бизнес-сценарий: Нераспознаваемая цель — должен бросить ошибку.
     */
    it("NLP-G4: throws on unrecognizable goal", async () => {
      // Проверяем что бросается ошибка (не возвращается пустой результат)
      await expect(parseGoalQuery(apiKey, "hello world", baseUrl)).rejects.toThrow();
    });
  });
});
