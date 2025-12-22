/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { SessionService } from "../../../src/telegram-bot/services/session-service.js";
import { SessionError } from "../../../src/telegram-bot/errors.js";

import { TelegramTestContext } from "../helpers/test-context.js";

import type { BotContext } from "../../../src/telegram-bot/types.js";

/**
 * Integration тесты для SessionService.
 *
 * Тестируем реальное взаимодействие:
 * - SessionService → Redis (кэширование sessionId)
 * - SessionService → MCP Server (register_telegram)
 *
 * Бизнес-критичность:
 * - Управление сессиями — основа авторизации
 * - Кэширование снижает нагрузку на MCP Server
 * - Ошибка = пользователь не может пользоваться ботом
 */

// Test user IDs (не пересекаются с fixtures U1-U3)
const TEST_USER_1 = 999001;
const TEST_USER_2 = 999002;

/**
 * Creates minimal BotContext for testing.
 * SessionService only uses: ctx.from?.id and ctx.session
 */
function createBotContext(userId?: number): BotContext {
  return {
    from: userId ? { id: userId } : undefined,
    session: { status: "uninitialised" },
  } as BotContext;
}

describe("SessionService Integration", () => {
  let service: SessionService;

  beforeEach(async () => {
    const ctx = TelegramTestContext.getInstance();
    service = new SessionService(ctx.mcpClient, ctx.redis);

    // Clean up test users from Redis before each test
    await ctx.redis.del(`telegram:session:${TEST_USER_1}:sessionId`);
    await ctx.redis.del(`telegram:session:${TEST_USER_2}:sessionId`);
  });

  afterEach(async () => {
    // Clean up after tests
    const ctx = TelegramTestContext.getInstance();
    await ctx.redis.del(`telegram:session:${TEST_USER_1}:sessionId`);
    await ctx.redis.del(`telegram:session:${TEST_USER_2}:sessionId`);
  });

  describe("initialize", () => {
    /**
     * SS-I1: Успешная инициализация сессии
     *
     * Given: Новый пользователь (не в кэше)
     * When: Вызываем initialize
     * Then: MCP вызван, sessionId сохранён в Redis, ctx.session обновлён
     */
    it("SS-I1: initializes session via MCP and caches in Redis", async () => {
      const ctx = TelegramTestContext.getInstance();
      const botCtx = createBotContext(TEST_USER_1);

      await service.initialize(botCtx);

      // ctx.session должен быть обновлён
      expect(botCtx.session.status).toBe("initialised");
      // Narrowing для TypeScript
      if (botCtx.session.status !== "initialised") throw new Error("unexpected");
      // token может быть null (существующий пользователь) или string (новый)
      expect(botCtx.session.token === null || typeof botCtx.session.token === "string").toBe(true);

      // sessionId должен быть в Redis
      const cachedSessionId = await ctx.redis.get(`telegram:session:${TEST_USER_1}:sessionId`);
      expect(cachedSessionId).toBeDefined();
      expect(cachedSessionId).toMatch(/^sess_/);
    });

    /**
     * SS-I2: Ошибка при отсутствии userId
     *
     * Given: Контекст без from.id
     * When: Вызываем initialize
     * Then: Бросается SessionError
     */
    it("SS-I2: throws SessionError when userId is missing", async () => {
      const botCtx = createBotContext(); // no userId

      await expect(service.initialize(botCtx)).rejects.toThrow(SessionError);
      await expect(service.initialize(botCtx)).rejects.toThrow("Telegram user ID not found");
    });
  });

  describe("getSessionId", () => {
    /**
     * SS-G1: Возврат sessionId из кэша (cache hit)
     *
     * Given: sessionId уже в Redis
     * When: Вызываем getSessionId
     * Then: Возвращается из кэша без вызова MCP
     */
    it("SS-G1: returns sessionId from Redis cache", async () => {
      const ctx = TelegramTestContext.getInstance();
      const botCtx = createBotContext(TEST_USER_1);

      // Pre-populate cache
      await ctx.redis.setex(`telegram:session:${TEST_USER_1}:sessionId`, 1800, "cached_session_xyz");

      const sessionId = await service.getSessionId(botCtx);

      expect(sessionId).toBe("cached_session_xyz");
    });

    /**
     * SS-G2: Cache miss — вызов MCP и сохранение в Redis
     *
     * Given: sessionId НЕ в кэше
     * When: Вызываем getSessionId
     * Then: MCP вызван, sessionId сохранён в Redis
     */
    it("SS-G2: calls MCP and caches on cache miss", async () => {
      const ctx = TelegramTestContext.getInstance();
      const botCtx = createBotContext(TEST_USER_2);

      // Убедимся что кэш пуст
      const before = await ctx.redis.get(`telegram:session:${TEST_USER_2}:sessionId`);
      expect(before).toBeNull();

      const sessionId = await service.getSessionId(botCtx);

      // Должен вернуть валидный sessionId
      expect(sessionId).toMatch(/^sess_/);

      // sessionId должен быть закэширован
      const cached = await ctx.redis.get(`telegram:session:${TEST_USER_2}:sessionId`);
      expect(cached).toBe(sessionId);
    });

    /**
     * SS-G3: Cache miss обновляет uninitialised session
     *
     * Given: ctx.session.status = "uninitialised"
     * When: Вызываем getSessionId (cache miss)
     * Then: ctx.session обновляется до "initialised"
     */
    it("SS-G3: updates uninitialised session on cache miss", async () => {
      const botCtx = createBotContext(TEST_USER_1);
      expect(botCtx.session.status).toBe("uninitialised");

      await service.getSessionId(botCtx);

      expect(botCtx.session.status).toBe("initialised");
      // Narrowing для TypeScript
      if (botCtx.session.status !== "initialised") throw new Error("unexpected");
      // token может быть null или string
      expect(botCtx.session.token === null || typeof botCtx.session.token === "string").toBe(true);
    });

    /**
     * SS-G4: Cache miss НЕ перезаписывает initialised session
     *
     * Given: ctx.session уже initialised
     * When: Вызываем getSessionId (cache miss)
     * Then: ctx.session НЕ меняется
     */
    it("SS-G4: does not overwrite initialised session on cache miss", async () => {
      const botCtx = createBotContext(TEST_USER_1);
      botCtx.session = {
        status: "initialised",
        token: "existing_token",
        userId: "usr_00000000-0000-0000-0000-000000000001",
        sessionId: "sess_00000000-0000-7000-8000-000000000001",
      };

      await service.getSessionId(botCtx);

      // Session не должна быть перезаписана
      expect(botCtx.session.status).toBe("initialised");
      if (botCtx.session.status === "initialised") {
        expect(botCtx.session.token).toBe("existing_token");
      }
    });

    /**
     * SS-G5: Ошибка при отсутствии userId
     *
     * Given: Контекст без from.id
     * When: Вызываем getSessionId
     * Then: Бросается SessionError
     */
    it("SS-G5: throws SessionError when userId is missing", async () => {
      const botCtx = createBotContext(); // no userId

      await expect(service.getSessionId(botCtx)).rejects.toThrow(SessionError);
      await expect(service.getSessionId(botCtx)).rejects.toThrow("Telegram user ID not found");
    });
  });

  describe("saveSessionId", () => {
    /**
     * SS-S1: Сохранение sessionId в Redis с TTL
     *
     * Given: userId и sessionId
     * When: Вызываем saveSessionId
     * Then: Сохранено в Redis
     */
    it("SS-S1: saves sessionId to Redis", async () => {
      const ctx = TelegramTestContext.getInstance();

      await service.saveSessionId(TEST_USER_1, "manual_session_123");

      const cached = await ctx.redis.get(`telegram:session:${TEST_USER_1}:sessionId`);
      expect(cached).toBe("manual_session_123");
    });
  });
});
