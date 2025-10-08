import { describe, test, expect, vi } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { z } from "zod";
import {
  executeRead,
  getStrictSkills,
} from "../../../src/search-modes/helpers.js";
import { getValidatedTypes } from "../../../src/schemas-zod.js";
import { loadTestData } from "../../helpers/test-data-loader.js";

function createMockRecord(value: unknown) {
  return {
    get: (key: string) => (key === "result" ? value : undefined),
  };
}

describe("helpers", () => {
  test("should execute executeRead and close session on success", async () => {
    const mockResult = { records: [] };
    const run = vi.fn().mockResolvedValue(mockResult);
    const close = vi.fn().mockResolvedValue(undefined);
    const executeReadImpl = vi
      .fn()
      .mockImplementation((work: (tx: any) => Promise<any>) => work({ run }));
    const session = {
      executeRead: executeReadImpl,
      close,
    } as unknown as Session;
    const driver = {
      session: vi.fn(() => session),
    } as unknown as Driver;

    const cypherResult = await executeRead(driver, "MATCH (n)", {
      limit: 5,
    });

    expect(driver.session).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("MATCH (n)", { limit: 5 });
    expect(close).toHaveBeenCalledTimes(1);
    expect(cypherResult).toBe(mockResult);
  });

  test("should close session when executeRead throws", async () => {
    const run = vi.fn().mockRejectedValue(new Error("driver down"));
    const close = vi.fn().mockResolvedValue(undefined);
    const executeReadImpl = vi
      .fn()
      .mockImplementation((work: (tx: any) => Promise<any>) => work({ run }));
    const session = {
      executeRead: executeReadImpl,
      close,
    } as unknown as Session;
    const driver = {
      session: vi.fn(() => session),
    } as unknown as Driver;

    await expect(
      executeRead(driver, "MATCH (n)", { limit: 1 })
    ).rejects.toThrow("driver down");
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("should validate records via getValidatedTypes", () => {
    const schema = z.object({
      id: z.string(),
      score: z.number().min(0).max(100),
    });
    const validRecords = [
      { id: "usr_123", score: 78 },
      { id: "usr_456", score: 91 },
    ];
    const mockResult = {
      records: validRecords.map(createMockRecord),
    };

    const parsed = getValidatedTypes(mockResult.records, schema);

    expect(parsed).toEqual(validRecords);
  });

  test("should throw when getValidatedTypes receives invalid data", () => {
    const schema = z.object({ id: z.string() });
    const mockResult = {
      records: [createMockRecord({ id: 123 })],
    };

    expect(() => getValidatedTypes(mockResult.records, schema)).toThrow(
      /Expected string/
    );
  });

  test("should return strict skills from real context data", () => {
    const story = loadTestData("USER_001");
    const firstContext = story.contexts[0];
    if (!firstContext) {
      throw new Error("USER_001 must include at least one context");
    }

    // 📝 БИЗНЕС-СЦЕНАРИЙ: Подтягиваем навыки из реального контекста пользователя
    const strictSkills = getStrictSkills(firstContext.skills);

    expect(Array.isArray(strictSkills)).toBe(true);
    expect(strictSkills.every((skill) => typeof skill === "string")).toBe(true);
  });

  test("should filter skills by strict categories", () => {
    const skills = [
      { name: "python", category: "language" },
      { name: "mentoring", category: "soft" },
      { name: "kubernetes", category: "runtime" },
    ] as const;

    const filtered = getStrictSkills(skills as any);

    expect(filtered).toEqual(["python", "kubernetes"]);
  });

  test("should return empty array for undefined or empty skills", () => {
    expect(getStrictSkills(undefined)).toEqual([]);
    expect(getStrictSkills([])).toEqual([]);
  });
});
