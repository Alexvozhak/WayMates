import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { Driver } from "neo4j-driver";
import {
  DEFAULT_STRICT_SKILL_CATEGORIES,
  type CurrentOnlyParams,
} from "../../../src/schemas-zod.js";
import {
  DEFAULT_REASONS_TO_TRACK,
  DEFAULT_SEARCH_CONSTRAINTS,
} from "../../../src/unified-search-types.js";
import { SearchQueries } from "../../../src/cypher/api.js";
import { loadTestData } from "../../helpers/test-data-loader.js";

const { executeReadMock, getStrictSkillsMock, getValidatedTypesMock } =
  vi.hoisted(() => ({
    executeReadMock: vi.fn(),
    getStrictSkillsMock: vi.fn(),
    getValidatedTypesMock: vi.fn(),
  }));

vi.mock("../../../src/search-modes/helpers.js", () => ({
  executeRead: executeReadMock,
  getStrictSkills: getStrictSkillsMock,
}));

vi.mock("../../../src/schemas-zod.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getValidatedTypes: getValidatedTypesMock,
  };
});

import { executeCurrentOnly } from "../../../src/search-modes/current-only.js";

describe("current-only", () => {
  const driverStub = {} as Driver;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    executeReadMock.mockReset();
    getStrictSkillsMock.mockReset();
    getValidatedTypesMock.mockReset();
  });

  test("should execute SearchQueries.CURRENT_ONLY with strict skills", async () => {
    const story = loadTestData("USER_002");
    const context = story.contexts[0];
    if (!context) {
      throw new Error("USER_002 must include at least one context");
    }

    const params: CurrentOnlyParams = {
      currentContext: context,
      lookAheadMonths: 12,
      reasonsToTrack: DEFAULT_REASONS_TO_TRACK,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
      maxUsers: 5,
    };

    const strictSkills = ["python", "kubernetes"];
    const validated = [{ user_id: "usr_001" }];
    getStrictSkillsMock.mockReturnValue(strictSkills);
    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue(validated);

    const result = await executeCurrentOnly(driverStub, params);

    expect(getStrictSkillsMock).toHaveBeenCalledWith(
      context.skills,
      DEFAULT_STRICT_SKILL_CATEGORIES
    );
    expect(executeReadMock).toHaveBeenCalledWith(
      driverStub,
      SearchQueries.CURRENT_ONLY,
      expect.objectContaining({
        currentContext: context,
        strictSkills,
        timePeriod: 12,
        reasonsToTrack: DEFAULT_REASONS_TO_TRACK,
        searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
      })
    );
    expect(getValidatedTypesMock).toHaveBeenCalledWith([], expect.anything());
    expect(result).toBe(validated);
  });

  test("should fall back to default reasons and constraints when omitted", async () => {
    const story = loadTestData("USER_003");
    const context = story.contexts[0];
    if (!context) {
      throw new Error("USER_003 must include at least one context");
    }

    const params = {
      currentContext: context,
      lookAheadMonths: 6,
      reasonsToTrack: undefined,
      searchConstraints: undefined,
    } as unknown as CurrentOnlyParams;

    getStrictSkillsMock.mockReturnValue([]);
    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockReturnValue([]);

    await executeCurrentOnly(driverStub, params);

    const [, , cypherParams] = executeReadMock.mock.calls[0]!;
    expect(cypherParams.reasonsToTrack).toEqual(DEFAULT_REASONS_TO_TRACK);
    expect(cypherParams.searchConstraints).toEqual(DEFAULT_SEARCH_CONSTRAINTS);
    expect(cypherParams.timePeriod).toBe(6);
  });

  test.each([[1], [120]])(
    "should pass lookAheadMonths=%s to Cypher params",
    async (months) => {
      const story = loadTestData("USER_004");
      const context = story.contexts[0];
      if (!context) {
        throw new Error("USER_004 must include at least one context");
      }

      const params: CurrentOnlyParams = {
        currentContext: context,
        lookAheadMonths: months,
        reasonsToTrack: DEFAULT_REASONS_TO_TRACK,
        searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
      };

      getStrictSkillsMock.mockReturnValue([]);
      executeReadMock.mockResolvedValue({ records: [] });
      getValidatedTypesMock.mockReturnValue([]);

      await executeCurrentOnly(driverStub, params);

      const [, , cypherParams] = executeReadMock.mock.calls.at(-1)!;
      expect(cypherParams.timePeriod).toBe(months);
    }
  );

  test("should surface validation errors from getValidatedTypes", async () => {
    const story = loadTestData("USER_005");
    const context = story.contexts[0];
    if (!context) {
      throw new Error("USER_005 must include at least one context");
    }

    const params: CurrentOnlyParams = {
      currentContext: context,
      lookAheadMonths: 3,
      reasonsToTrack: DEFAULT_REASONS_TO_TRACK,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    getStrictSkillsMock.mockReturnValue([]);
    executeReadMock.mockResolvedValue({ records: [] });
    getValidatedTypesMock.mockImplementation(() => {
      throw new Error("AvatarResearchResult validation failed");
    });

    await expect(executeCurrentOnly(driverStub, params)).rejects.toThrow(
      "AvatarResearchResult validation failed"
    );
  });
});
