import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Driver } from "neo4j-driver";
import {
  DEFAULT_STRICT_SKILL_CATEGORIES,
  type CurrentToTargetParams,
} from "../../../src/schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../../../src/unified-search-types.js";
import { Finders, Processors } from "../../../src/cypher/api.js";
import { loadTestData } from "../../helpers/test-data-loader.js";

const { runQueryMock, getStrictSkillsMock, getValidatedTypesMock } = vi.hoisted(
  () => ({
    runQueryMock: vi.fn(),
    getStrictSkillsMock: vi.fn(),
    getValidatedTypesMock: vi.fn(),
  })
);

vi.mock("../../../src/search-modes/helpers.js", () => ({
  executeRead: runQueryMock,
  getStrictSkills: getStrictSkillsMock,
}));

vi.mock("../../../src/schemas-zod.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getValidatedTypes: getValidatedTypesMock,
  };
});

import { executeCurrentToTarget } from "../../../src/search-modes/current-to-target.js";

describe("current-to-target", () => {
  const driverStub = {} as Driver;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should call executeRead with current and target contexts and dynamic query", async () => {
    const story = loadTestData("USER_001");
    const [currentContext, targetContext] = story.contexts.slice(0, 2);
    if (!currentContext || !targetContext) {
      throw new Error("USER_001 must include at least two contexts");
    }

    const params: CurrentToTargetParams = {
      currentContext,
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    getStrictSkillsMock.mockReturnValue(["typescript"]);
    runQueryMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue([
      { user_id: "usr_010", compatibility: 87 },
    ]);

    const result = await executeCurrentToTarget(driverStub, params);

    expect(getStrictSkillsMock).toHaveBeenCalledWith(
      currentContext.skills,
      DEFAULT_STRICT_SKILL_CATEGORIES
    );
    expect(runQueryMock).toHaveBeenCalledTimes(1);
    const [drv, cypher, cypherParams] = runQueryMock.mock.calls[0]!;
    expect(drv).toBe(driverStub);
    expect(typeof cypher).toBe("string");
    expect(cypher).toContain("WITH $currentContext AS requestedCurrentContext");
    expect(cypher).toContain(
      "MATCH\n  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)"
    );
    // Убеждаемся, что в конвейер добавлены следующие шаги
    expect(cypher).toContain("ОРКЕСТРИРОВАННЫЙ ПОИСК TARGET КОНТЕКСТОВ");
    expect(cypher).toContain("БЛОК 3: РАСЧЕТ МЕТРИК СОВМЕСТИМОСТИ");
    expect(cypherParams).toEqual({
      currentContext,
      targetContext,
      strictSkills: ["typescript"],
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    });
    expect(result).toEqual([{ user_id: "usr_010", compatibility: 87 }]);
  });

  test("should use default search constraints when undefined", async () => {
    const story = loadTestData("USER_002");
    const [currentContext, targetContext] = story.contexts.slice(0, 2);
    if (!currentContext || !targetContext) {
      throw new Error("USER_002 must include at least two contexts");
    }

    const params = {
      currentContext,
      targetContext,
      searchConstraints: undefined,
    } as unknown as CurrentToTargetParams;

    getStrictSkillsMock.mockReturnValue([]);
    runQueryMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue([]);

    await executeCurrentToTarget(driverStub, params);

    const [, , cypherParams] = runQueryMock.mock.calls[0]!;
    expect(cypherParams.searchConstraints).toEqual(DEFAULT_SEARCH_CONSTRAINTS);
  });

  test("should surface validation errors for result schema", async () => {
    const story = loadTestData("USER_003");
    const [currentContext, targetContext] = story.contexts.slice(0, 2);
    if (!currentContext || !targetContext) {
      throw new Error("USER_003 must include at least two contexts");
    }

    const params: CurrentToTargetParams = {
      currentContext,
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    getStrictSkillsMock.mockReturnValue([]);
    runQueryMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockImplementation(() => {
      // 🚨 ПРОБЛЕМА: Валидация результата не прошла, проверяем bubbling ошибки
      throw new Error("CurrentToTargetResultSchema failed");
    });

    await expect(executeCurrentToTarget(driverStub, params)).rejects.toThrow(
      "CurrentToTargetResultSchema failed"
    );
  });
});
