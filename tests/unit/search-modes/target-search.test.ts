import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Driver } from "neo4j-driver";
import {
  type TargetSearchParams,
  AvatarSearchResultSchema,
} from "../../../src/schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../../../src/unified-search-types.js";
import { SearchQueries } from "../../../src/cypher/api.js";
import { loadTestData } from "../../helpers/test-data-loader.js";

const { executeReadMock, getValidatedTypesMock } = vi.hoisted(() => ({
  executeReadMock: vi.fn(),
  getValidatedTypesMock: vi.fn(),
}));

vi.mock("../../../src/search-modes/helpers.js", () => ({
  executeRead: executeReadMock,
}));

vi.mock("../../../src/schemas-zod.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getValidatedTypes: getValidatedTypesMock,
  };
});

import { executeTargetSearch } from "../../../src/search-modes/target-search.js";

describe("target-search", () => {
  const driverStub = {} as Driver;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should validate avatar search results", async () => {
    const story = loadTestData("USER_008");
    const targetContext = story.contexts.at(-1);
    if (!targetContext) {
      throw new Error("USER_008 must include at least one context");
    }

    const params: TargetSearchParams = {
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    const sampleResult = AvatarSearchResultSchema.parse({
      user_id: story.user_id,
      ...targetContext,
    });

    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue([sampleResult]);

    const result = await executeTargetSearch(driverStub, params);

    expect(executeReadMock).toHaveBeenCalledWith(
      driverStub,
      SearchQueries.TARGET_SEARCH,
      {
        targetContext,
        searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
      }
    );
    expect(getValidatedTypesMock).toHaveBeenCalledWith(
      [],
      AvatarSearchResultSchema
    );
    expect(result).toEqual([sampleResult]);
  });

  test("should provide default search constraints", async () => {
    const story = loadTestData("USER_009");
    const targetContext = story.contexts[0];
    if (!targetContext) {
      throw new Error("USER_009 must include at least one context");
    }

    const params = {
      targetContext,
      searchConstraints: undefined,
    } as unknown as TargetSearchParams;

    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue([]);

    await executeTargetSearch(driverStub, params);

    const [, , cypherParams] = executeReadMock.mock.calls[0]!;
    expect(cypherParams.searchConstraints).toEqual(DEFAULT_SEARCH_CONSTRAINTS);
  });

  test("should bubble validation errors", async () => {
    const story = loadTestData("USER_010");
    const targetContext = story.contexts[0];
    if (!targetContext) {
      throw new Error("USER_010 must include at least one context");
    }

    const params: TargetSearchParams = {
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockImplementation(() => {
      // 🚨 ПРОБЛЕМА: Нарушена схема AvatarSearchResult, функция должна пробрасывать ошибку
      throw new Error("AvatarSearchResultSchema failed");
    });

    await expect(executeTargetSearch(driverStub, params)).rejects.toThrow(
      "AvatarSearchResultSchema failed"
    );
  });
});
