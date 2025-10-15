import { describe, test, beforeEach, afterEach, expect, vi } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { join } from "path";
import { loadTestData } from "../helpers/test-data-loader.js";
import { AvatarSearchResultSchema } from "../../src/schemas-zod.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";

const clone = <T>(value: T): T =>
  typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const fastMCPInstances: MockFastMCP[] = [];

class MockFastMCP {
  public tools: Array<{
    name: string;
    execute: (args: unknown) => Promise<string>;
  }> = [];

  constructor(public options: Record<string, unknown>) {
    fastMCPInstances.push(this);
  }

  addTool(tool: (typeof this.tools)[number]) {
    this.tools.push(tool);
  }

  addPrompt() {}
  addResource() {}
  addResourceTemplate() {}
}

vi.mock("fastmcp", () => ({
  FastMCP: MockFastMCP,
}));

const { createWayMatesServer } = await import("../../src/mcp-server.js");
const { PresetsManager } = await import(
  "../../src/orcestrator/preset-manager.js"
);

import { PRESETS_PATH } from "../../src/config.js";

const BASE_CONSTRAINTS = {
  max_timing_diff_months: 12,
  timing_diff_threshold_percent: 20,
  max_experience_diff_months: 60,
  results_limit: 10,
} as const;

const getTool = (name: string) => {
  const instance = fastMCPInstances.at(-1);
  if (!instance) {
    throw new Error("FastMCP instance was not created");
  }
  const tool = instance.tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Tool ${name} was not registered`);
  }
  return tool;
};

describe("MCP workflow scenarios", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    fastMCPInstances.length = 0;
    ({ driver, session } = await setupIntegrationTest());
    const presets = new PresetsManager(PRESETS_PATH);
    createWayMatesServer(driver, presets);
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("target search returns ingested user after story ingestion", async () => {
    // 📝 ARRANGE: Загружаем реальную историю и сохраняем через MCP
    const story = loadTestData("USER_004");
    await getTool("execute_upsert_story").execute(story);

    // 🎯 ACT: Запускаем целевой поиск по последнему контексту пользователя
    const responseJson = await getTool("target_search").execute({
      targetContext: story.contexts.at(-1)!,
      searchConstraints: BASE_CONSTRAINTS,
    });

    // ✅ ASSERT: Проверяем, что пользователь присутствует в результатах
    const entries = JSON.parse(responseJson);
    expect(Array.isArray(entries)).toBe(true);
    entries.forEach((entry: unknown) => {
      expect(() => AvatarSearchResultSchema.parse(entry)).not.toThrow();
    });
    expect(
      entries.some(
        (entry: { user_id?: string }) => entry.user_id === story.user_id
      )
    ).toBe(true);
  });

  test("user can remove an existing trail via MCP tools", async () => {
    const story = loadTestData("USER_006");
    await getTool("execute_upsert_story").execute(story);

    // 📝 ARRANGE: Убеждаемся, что сервис доступен и находим первый trail пользователя
    const pingResult = JSON.parse(await getTool("ping").execute({}));
    expect(pingResult.status).toBe("ok");

    const trailRecord = await session.executeRead((tx) =>
      tx.run(
        `MATCH (u:User {user_id: $userId})-[:HAS_TRAIL]->(t:Trail)
         RETURN t.trail_id AS id
         LIMIT 1`,
        { userId: story.user_id }
      )
    );
    const trailId = trailRecord.records[0]!.get("id");

    // 🎯 ACT: Удаляем trail через MCP
    const deleteTrailResponse = JSON.parse(
      await getTool("delete_trail").execute({
        user_id: story.user_id,
        trail_id: trailId,
      })
    );

    // ✅ ASSERT: Запись исчезла из графа
    expect(deleteTrailResponse.deleted).toBe(true);
    const trailAfter = await session.executeRead((tx) =>
      tx.run(
        `MATCH (u:User {user_id: $userId})-[:HAS_TRAIL]->(t:Trail {trail_id: $trailId})
         RETURN count(t) AS remaining`,
        { userId: story.user_id, trailId }
      )
    );
    expect(Number(trailAfter.records[0]?.get("remaining") ?? 0)).toBe(0);
  });

  test("user can add and delete standalone context via MCP", async () => {
    const story = loadTestData("USER_006");
    await getTool("execute_upsert_story").execute(story);

    const templateContext = clone(story.contexts[0]!);
    templateContext.created_at = "2035-05-05T00:00:00Z";
    templateContext.context_id = "ctx_temp";

    // 📝 БИЗНЕС-СЦЕНАРИЙ: Пользователь добавляет временный контекст для эксперимента
    await getTool("upsert_context").execute({
      user_id: story.user_id,
      contexts: [templateContext],
    });

    const newContextRecord = await session.executeRead((tx) =>
      tx.run(
        `MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context)
         WHERE c.created_at = datetime($createdAt)
         RETURN c.context_id AS id`,
        { userId: story.user_id, createdAt: templateContext.created_at }
      )
    );

    const newContextId = newContextRecord.records[0]!.get("id");
    const deleteContextResponse = JSON.parse(
      await getTool("delete_context").execute({
        user_id: story.user_id,
        context_id: newContextId,
      })
    );

    expect(deleteContextResponse.deleted).toBe(true);

    const storySnapshot = JSON.parse(
      await getTool("get_user_story").execute({ user_id: story.user_id })
    );
    expect(Array.isArray(storySnapshot.contexts)).toBe(true);
    expect(Array.isArray(storySnapshot.trails)).toBe(true);
    expect(
      storySnapshot.contexts.some(
        (context: { context_id?: string }) =>
          context.context_id === newContextId
      )
    ).toBe(false);
  });
});
