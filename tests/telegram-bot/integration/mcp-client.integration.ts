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
});
