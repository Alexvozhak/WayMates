import { describe, expect, it, beforeAll } from "vitest";

import { SearchPresenter } from "../../../../src/telegram-bot/presenters/search-presenter.js";
import { WelcomePresenter } from "../../../../src/telegram-bot/presenters/welcome-presenter.js";
import { StoryPresenter } from "../../../../src/telegram-bot/presenters/story-presenter.js";
import { GoalPresenter } from "../../../../src/telegram-bot/presenters/goal-presenter.js";
import { LangGraphPresenter } from "../../../../src/telegram-bot/presenters/langgraph-presenter.js";

import type { LlmConfig } from "../../../../src/telegram-bot/types.js";

/**
 * Integration тесты для Presenters.
 *
 * Тестируем реальный LLM вызов через OpenRouter.
 * Проверяем что:
 * 1. format() возвращает непустую строку
 * 2. Output содержит ключевые данные из input
 * 3. Язык ответа соответствует languageCode
 *
 * НЕ тестируем:
 * - Bottleneck rate limiting (проверенная библиотека)
 * - Точное содержание (LLM недетерминистичен)
 */

const LLM_CONFIG: LlmConfig = {
  model: "openai/gpt-4o-mini",
  temperature: 0.3,
};

const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const API_BASE = "https://openrouter.ai/api/v1";
const RPM_LIMIT = 60;
const MAX_CONCURRENT = 5;

describe("Presenters Integration (Real LLM)", () => {
  beforeAll(() => {
    if (!API_KEY) {
      throw new Error("OPENROUTER_API_KEY required for presenter tests");
    }
  });

  describe("SearchPresenter", () => {
    let presenter: SearchPresenter;

    beforeAll(() => {
      presenter = new SearchPresenter(API_KEY, LLM_CONFIG, RPM_LIMIT, MAX_CONCURRENT, API_BASE);
    });

    /**
     * TC-PR1: Search results formatting (happy path)
     *
     * Что тестируем:
     * SearchPresenter форматирует результаты поиска в читаемый текст.
     * LLM должен упомянуть позиции и similarity из input.
     *
     * Given:
     * - 2 кандидата с разными позициями и similarity
     * - languageCode: "en"
     *
     * Then:
     * - Непустая строка
     * - Упоминает "Senior Python Developer" или "Python"
     * - Упоминает similarity (75% или 75)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR1: formats search results with key data", async () => {
      const searchResults = [
        {
          userId: "user_1",
          position: "Senior Python Developer",
          skills: ["Python", "FastAPI", "PostgreSQL"],
          similarity: 0.75,
        },
        {
          userId: "user_2",
          position: "Backend Engineer",
          skills: ["Node.js", "TypeScript", "MongoDB"],
          similarity: 0.62,
        },
      ];

      const result = await presenter.format(searchResults, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/python|developer/i);
      expect(result).toMatch(/75|0\.75/);
    });

    /**
     * TC-PR2: Empty search results
     *
     * Что тестируем:
     * LLM gracefully обрабатывает пустой массив результатов.
     *
     * Given:
     * - Пустой массив
     *
     * Then:
     * - Непустая строка (объяснение что ничего не найдено)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR2: handles empty results gracefully", async () => {
      const result = await presenter.format([], "en");

      expect(result.length).toBeGreaterThan(0);
    });

    /**
     * TC-PR3: Russian language output
     *
     * Что тестируем:
     * При languageCode="ru" LLM отвечает на русском.
     *
     * Given:
     * - Search results
     * - languageCode: "ru"
     *
     * Then:
     * - Содержит кириллицу
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR3: responds in Russian when requested", async () => {
      const searchResults = [
        {
          userId: "user_1",
          position: "Data Scientist",
          skills: ["Python", "ML"],
          similarity: 0.8,
        },
      ];

      const result = await presenter.format(searchResults, "ru");

      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/[а-яА-Я]/);
    });
  });

  describe("WelcomePresenter", () => {
    let presenter: WelcomePresenter;

    beforeAll(() => {
      presenter = new WelcomePresenter(API_KEY, LLM_CONFIG, RPM_LIMIT, MAX_CONCURRENT, API_BASE);
    });

    /**
     * TC-PR4: Welcome message for new user (no story)
     *
     * Что тестируем:
     * WelcomePresenter создаёт приветствие и рекомендует /story для нового юзера.
     *
     * Given:
     * - hasStory: false
     * - userName: "Alex"
     *
     * Then:
     * - Непустая строка
     * - Упоминает имя пользователя
     * - Упоминает /story или story
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR4: welcomes new user and suggests /story", async () => {
      const welcomeData = {
        hasStory: false,
        userName: "Alex",
      };

      const result = await presenter.format(welcomeData, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("alex");
      expect(result.toLowerCase()).toMatch(/story|career/i);
    });

    /**
     * TC-PR5: Welcome message for returning user (has story)
     *
     * Что тестируем:
     * WelcomePresenter рекомендует search команды для юзера с историей.
     *
     * Given:
     * - hasStory: true
     * - userName: "Maria"
     *
     * Then:
     * - Непустая строка
     * - Упоминает search команды (/by_target, /by_current, /by_adhoc)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR5: welcomes returning user with search suggestions", async () => {
      const welcomeData = {
        hasStory: true,
        userName: "Maria",
      };

      const result = await presenter.format(welcomeData, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/search|by_target|by_current|by_adhoc|find/i);
    });
  });

  describe("StoryPresenter", () => {
    let presenter: StoryPresenter;

    beforeAll(() => {
      presenter = new StoryPresenter(API_KEY, LLM_CONFIG, RPM_LIMIT, MAX_CONCURRENT, API_BASE);
    });

    /**
     * TC-PR6: Story formatting with contexts and trails
     *
     * Что тестируем:
     * StoryPresenter форматирует карьерную историю (contexts + trails).
     *
     * Given:
     * - 2 contexts (Junior, Senior)
     * - 1 trail (Python course)
     *
     * Then:
     * - Непустая строка
     * - Упоминает обе позиции
     * - Упоминает trail (Python или Coursera)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR6: formats story with positions and trails", async () => {
      const story = {
        contexts: [
          {
            contextId: "ctx_1",
            position: "Junior Developer",
            skills: ["JavaScript"],
            createdAt: "2020-01-01",
          },
          {
            contextId: "ctx_2",
            position: "Senior Developer",
            skills: ["TypeScript", "React"],
            createdAt: "2023-01-01",
          },
        ],
        trails: [
          {
            trailId: "trail_1",
            skill: "Python",
            platform: "Coursera",
            fromContextId: "ctx_1",
            toContextId: "ctx_2",
          },
        ],
      };

      const result = await presenter.format(story, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/junior|senior|developer/i);
      expect(result.toLowerCase()).toMatch(/python|coursera|trail|learning/i);
    });

    /**
     * TC-PR7: Empty story (no contexts)
     *
     * Что тестируем:
     * LLM gracefully обрабатывает пустую историю.
     *
     * Given:
     * - contexts: []
     * - trails: []
     *
     * Then:
     * - Непустая строка
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR7: handles empty story gracefully", async () => {
      const story = {
        contexts: [],
        trails: [],
      };

      const result = await presenter.format(story, "en");

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("GoalPresenter", () => {
    let presenter: GoalPresenter;

    beforeAll(() => {
      presenter = new GoalPresenter(API_KEY, LLM_CONFIG, RPM_LIMIT, MAX_CONCURRENT, API_BASE);
    });

    /**
     * TC-PR8: Goal formatting
     *
     * Что тестируем:
     * GoalPresenter форматирует карьерную цель пользователя.
     *
     * Given:
     * - targetContext с position, domains, skills
     *
     * Then:
     * - Непустая строка
     * - Упоминает позицию (Tech Lead)
     * - Упоминает домен (fintech)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR8: formats career goal with key criteria", async () => {
      const goal = {
        position: { mode: "desired", values: ["Tech Lead", "Engineering Manager"] },
        domains: { mode: "desired", values: ["fintech", "healthcare"] },
        skills: { mode: "desired", values: ["Leadership", "System Design"] },
      };

      const result = await presenter.format(goal, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/tech lead|engineering manager|lead/i);
      expect(result.toLowerCase()).toMatch(/fintech|healthcare/i);
    });
  });

  describe("LangGraphPresenter", () => {
    let presenter: LangGraphPresenter;

    beforeAll(() => {
      presenter = new LangGraphPresenter(API_KEY, LLM_CONFIG, RPM_LIMIT, MAX_CONCURRENT, API_BASE);
    });

    /**
     * TC-PR9: LangGraph awaiting_clarification phase
     *
     * Что тестируем:
     * LangGraphPresenter запрашивает недостающие поля.
     *
     * Given:
     * - phase: awaiting_clarification
     * - missingFields: ["position", "skills"]
     *
     * Then:
     * - Непустая строка
     * - Упоминает position или skills (запрос уточнения)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR9: formats clarification request", async () => {
      const langGraphResponse = {
        phase: "awaiting_clarification",
        missingFields: ["position", "skills"],
        message: "Please provide more details",
      };

      const result = await presenter.format(langGraphResponse, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/position|skills|provide|specify|missing/i);
    });

    /**
     * TC-PR10: LangGraph saved phase
     *
     * Что тестируем:
     * LangGraphPresenter подтверждает успешное сохранение.
     *
     * Given:
     * - phase: saved
     *
     * Then:
     * - Непустая строка
     * - Содержит позитивный тон (saved, success, done, ✅)
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR10: formats saved confirmation", async () => {
      const langGraphResponse = {
        phase: "saved",
        contextId: "ctx_123",
      };

      const result = await presenter.format(langGraphResponse, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/saved|success|done|complete|✅/i);
    });

    /**
     * TC-PR11: LangGraph story_gathering phase (cold-start)
     *
     * Что тестируем:
     * LangGraphPresenter поддерживает cold-start фазы.
     *
     * Given:
     * - phase: story_gathering
     * - message: собирает историю
     *
     * Then:
     * - Непустая строка
     * - Поощряет продолжить рассказ
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR11: formats story_gathering encouragement", async () => {
      const langGraphResponse = {
        phase: "story_gathering",
        message: "Tell me more about your career journey",
        collectedContexts: 0,
      };

      const result = await presenter.format(langGraphResponse, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/tell|share|continue|career|story/i);
    });

    /**
     * TC-PR12: LangGraph failed phase
     *
     * Что тестируем:
     * LangGraphPresenter gracefully обрабатывает ошибки.
     *
     * Given:
     * - phase: failed
     * - message: error description
     *
     * Then:
     * - Непустая строка
     * - Негативный тон или объяснение ошибки
     *
     * Тип теста: Integration (real LLM)
     */
    it("TC-PR12: formats error message", async () => {
      const langGraphResponse = {
        phase: "failed",
        message: "Unable to process your request due to invalid data",
      };

      const result = await presenter.format(langGraphResponse, "en");

      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toMatch(/error|sorry|unable|failed|issue|problem|❌/i);
    });
  });
});
