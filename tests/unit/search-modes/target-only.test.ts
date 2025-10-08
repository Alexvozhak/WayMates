import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Driver } from "neo4j-driver";
import { loadTestData } from "../../helpers/test-data-loader.js";
import {
  type TargetOnlyParams,
  TargetAnalysisResultSchema,
} from "../../../src/schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../../../src/unified-search-types.js";
import { SearchQueries } from "../../../src/cypher/api.js";

const { executeReadMock } = vi.hoisted(() => ({
  executeReadMock: vi.fn(),
}));

vi.mock("../../../src/search-modes/helpers.js", () => ({
  executeRead: executeReadMock,
}));

import { executeTargetOnly } from "../../../src/search-modes/target-only.js";

describe("target-only", () => {
  const driverStub = {} as Driver;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should validate aggregated target analysis result", async () => {
    const story = loadTestData("USER_004");
    const targetContext = story.contexts.at(-1);
    if (!targetContext) {
      throw new Error("USER_004 must include at least one context");
    }

    const params: TargetOnlyParams = {
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    const aggregatedResult = TargetAnalysisResultSchema.parse({
      targetPosition: targetContext.position ?? "Unknown role",
      totalAvatarsFound: 12,
      achievementPaths: [
        {
          fromPosition: "Middle Developer",
          startingIndustry: "IT",
          startingCompanySize: "100-500",
          percentageOfAchievers: 0.42,
          averageTransitionMonths: 14,
          totalMonthsFromStart: 60,
          successRate: 0.65,
          avatarCount: 8,
          avgPositionChanges: 2,
          avgCompanyChanges: 1,
          firstPromotionMonths: 18,
        },
      ],
      timingInsights: {
        medianMonths: 16,
        percentile25Months: 12,
        percentile75Months: 22,
        averageAgeAtAchievement: 32,
        averageStartingAge: 27,
      },
    });

    executeReadMock.mockResolvedValue({
      records: [
        {
          get: (key: string) => (key === "result" ? aggregatedResult : undefined),
        },
      ],
    });

    const result = await executeTargetOnly(driverStub, params);

    expect(executeReadMock).toHaveBeenCalledWith(
      driverStub,
      SearchQueries.TARGET_ONLY,
      {
        targetContext,
        searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
      }
    );
    expect(result).toEqual(aggregatedResult);
  });

  test("should throw when no target contexts found", async () => {
    const story = loadTestData("USER_005");
    const targetContext = story.contexts[0];
    if (!targetContext) {
      throw new Error("USER_005 must include at least one context");
    }

    const params: TargetOnlyParams = {
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    executeReadMock.mockResolvedValue({ records: [] });

    await expect(executeTargetOnly(driverStub, params)).rejects.toThrow(
      "No target contexts found"
    );
  });

  test("should use default search constraints when undefined", async () => {
    const story = loadTestData("USER_006");
    const targetContext = story.contexts[0];
    if (!targetContext) {
      throw new Error("USER_006 must include at least one context");
    }

    const params = {
      targetContext,
      searchConstraints: undefined,
    } as unknown as TargetOnlyParams;

    executeReadMock.mockResolvedValue({
      records: [
        {
          get: () => ({}) as unknown,
        },
      ],
    });

    await expect(executeTargetOnly(driverStub, params)).rejects.toThrow();

    const [, , cypherParams] = executeReadMock.mock.calls[0]!;
    expect(cypherParams.searchConstraints).toEqual(DEFAULT_SEARCH_CONSTRAINTS);
  });

  test("should surface schema validation problems", async () => {
    const story = loadTestData("USER_007");
    const targetContext = story.contexts[0];
    if (!targetContext) {
      throw new Error("USER_007 must include at least one context");
    }

    const params: TargetOnlyParams = {
      targetContext,
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    };

    executeReadMock.mockResolvedValue({
      records: [
        {
          // 🚨 ПРОБЛЕМА: Возвращается объект без targetPosition, валидация должна упасть
          get: () => ({ malformed: true }),
        },
      ],
    });

    await expect(executeTargetOnly(driverStub, params)).rejects.toThrow(
      /targetPosition/
    );
  });
});
