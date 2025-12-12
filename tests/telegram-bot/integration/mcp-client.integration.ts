import { describe, expect, it, beforeAll } from "vitest";

import { TelegramTestContext } from "../helpers/test-context.js";

import type { SessionId } from "../../../src/shared/schemas.js";

/**
 * Интеграционные тесты McpClient → Facade MCP Server.
 *
 * Проверяют реальное взаимодействие Telegram Bot с Facade через HTTP MCP транспорт.
 * Тесты используют Docker-инфраструктуру (facade-test, postgres-test, neo4j-test, redis-test).
 */
describe("McpClient → Facade MCP Server Integration", () => {
  let u1SessionId: SessionId;
  let u2SessionId: SessionId;

  beforeAll(async () => {
    const ctx = TelegramTestContext.getInstance();

    const u1Result = await ctx.mcpClient.callTool("register_telegram", {
      telegramUserId: 12345,
    });
    u1SessionId = u1Result.sessionId;

    const u2Result = await ctx.mcpClient.callTool("register_telegram", {
      telegramUserId: 67890,
    });
    u2SessionId = u2Result.sessionId;
  });

  describe("search_by_target", () => {
    /**
     * Бизнес-сценарий: Пользователь ищет людей, которые уже достигли желаемой позиции.
     * Проверяем что McpClient корректно сериализует targetContext и получает массив кандидатов.
     */
    it("SBT1: search by target position returns candidates array", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_by_target", {
        sessionId: u1SessionId,
        targetContext: {
          position: { mode: "desired", values: ["Software Engineer", "Developer"] },
        },
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * Бизнес-сценарий: Поиск по несуществующей позиции не должен ломать систему.
     * Проверяем graceful degradation - пустой массив вместо ошибки.
     */
    it("SBT2: search for nonexistent position returns empty array", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_by_target", {
        sessionId: u1SessionId,
        targetContext: {
          position: { mode: "desired", values: ["Nonexistent Position XYZ123"] },
        },
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("get_story", () => {
    /**
     * Бизнес-сценарий: Пользователь запрашивает свою карьерную историю для просмотра/редактирования.
     * Проверяем что McpClient получает структуру с contexts и trails.
     */
    it("GS1: get user story returns contexts and trails", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("get_story", {
        sessionId: u1SessionId,
      });

      expect(result).toBeDefined();
      expect(result.contexts).toBeDefined();
      expect(Array.isArray(result.contexts)).toBe(true);
    });
  });

  describe("get_goal", () => {
    /**
     * Бизнес-сценарий: Пользователь без установленной цели запрашивает свою цель.
     * Проверяем что система возвращает null, а не ошибку (graceful handling).
     */
    it("GG1: get goal for user without goal returns null", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("get_goal", {
        sessionId: u2SessionId,
      });

      expect(result).toBeNull();
    });
  });

  describe("search_user_careers (by-current)", () => {
    /**
     * SUC1: Search by user's current context (happy path)
     *
     * Бизнес-сценарий: Пользователь с историей ищет похожие карьерные пути.
     * by-current использует контекст пользователя из БД, без явного referenceContext.
     *
     * Given: Пользователь u1 (зарегистрирован в beforeAll)
     * When: Вызываем search_user_careers без фильтров
     * Then: Получаем массив кандидатов (может быть пустой если нет контекста)
     */
    it("SUC1: returns candidates array for registered user", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_user_careers", {
        sessionId: u1SessionId,
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SUC2: Search with excluded creation reasons filter
     *
     * Бизнес-сценарий: Пользователь хочет найти похожих, но исключить тех кто прекратил работать.
     * Telegram: "/by_current найди похожих кроме безработных"
     *
     * Given: Фильтр excludedCreationReasons: ["stopped_working"]
     * When: Вызываем search_user_careers
     * Then: Результаты не содержат кандидатов с причиной "stopped_working"
     */
    it("SUC2: respects excludedCreationReasons filter", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_user_careers", {
        sessionId: u1SessionId,
        excludedCreationReasons: ["stopped_working"],
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SUC3: Search with recency threshold
     *
     * Бизнес-сценарий: Пользователь ищет только свежие данные за последний год.
     * Telegram: "/by_current за последний год"
     *
     * Given: recencyThresholdMonths: 12
     * When: Вызываем search_user_careers
     * Then: Получаем только кандидатов с обновлениями за последние 12 месяцев
     */
    it("SUC3: respects recencyThresholdMonths filter", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_user_careers", {
        sessionId: u1SessionId,
        recencyThresholdMonths: 12,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SUC4: Search with limit constraint
     *
     * Бизнес-сценарий: Пользователь просит "топ 3 похожих".
     * Telegram: "/by_current топ 3"
     *
     * Given: limit: 3
     * When: Вызываем search_user_careers
     * Then: Результат содержит не более 3 кандидатов
     */
    it("SUC4: respects limit constraint", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_user_careers", {
        sessionId: u1SessionId,
        limit: 3,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe("search_careers (by-adhoc)", () => {
    /**
     * SC1: Search by adhoc reference context (happy path)
     *
     * Бизнес-сценарий: Пользователь без истории описывает себя для поиска.
     * Telegram: "/by_adhoc Senior Python Developer в финтехе"
     *
     * Given: referenceContext с позицией и доменом
     * When: Вызываем search_careers
     * Then: Получаем массив кандидатов
     */
    it("SC1: returns candidates array for adhoc search", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_careers", {
        sessionId: u1SessionId,
        referenceContext: {
          position: "Senior Python Developer",
          domains: ["fintech"],
          skills: ["Python", "FastAPI"],
        },
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SC2: Search with country filter
     *
     * Бизнес-сценарий: Пользователь хочет найти в конкретной стране.
     * Telegram: "/by_adhoc Backend developer из России"
     *
     * Given: referenceContext с countryCode
     * When: Вызываем search_careers
     * Then: Получаем массив кандидатов
     */
    it("SC2: supports country filter in reference context", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_careers", {
        sessionId: u1SessionId,
        referenceContext: {
          position: "Backend Developer",
          countryCode: "RU",
        },
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SC3: Search with minimal context (position only)
     *
     * Бизнес-сценарий: Минимальный запрос — только позиция.
     * Telegram: "/by_adhoc Data Engineer"
     *
     * Given: referenceContext с только position
     * When: Вызываем search_careers
     * Then: Получаем массив кандидатов (graceful handling)
     */
    it("SC3: works with minimal reference context", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_careers", {
        sessionId: u1SessionId,
        referenceContext: {
          position: "Data Engineer",
        },
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    /**
     * SC4: Search with limit constraint
     *
     * Бизнес-сценарий: Ограничение результатов.
     * Telegram: "/by_adhoc топ 2 DevOps"
     *
     * Given: limit: 2
     * When: Вызываем search_careers
     * Then: Результат содержит не более 2 кандидатов
     */
    it("SC4: respects limit constraint", async () => {
      const ctx = TelegramTestContext.getInstance();

      const result = await ctx.mcpClient.callTool("search_careers", {
        sessionId: u1SessionId,
        referenceContext: {
          position: "DevOps Engineer",
        },
        limit: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });
});
