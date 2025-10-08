import { describe, test, expect } from "vitest";
import {
  calculateExplicitScore,
  type ScoringInput,
} from "../../src/scoring.js";
import type { ScoringWeights } from "../../config/scoring.js";

// Test weights - simple values for easy manual calculation
const TEST_WEIGHTS: ScoringWeights = {
  matchedSkills: 0.5,
  coverage: 0.2,
  domainOverlap: 0.1,
  countryMatch: 0.1,
  cityMatch: 0.1,
};

describe("Scoring calculations", () => {
  test("should calculate explicitScore with test weights", () => {
    const input: ScoringInput = {
      matchedSkills: 3,
      coverage: 0.6,
      domainOverlap: 1,
      countryMatch: 1,
      cityMatch: 0,
    };

    const result = calculateExplicitScore(input, TEST_WEIGHTS);

    const expected =
      3 * TEST_WEIGHTS.matchedSkills +
      0.6 * TEST_WEIGHTS.coverage +
      1 * TEST_WEIGHTS.domainOverlap +
      1 * TEST_WEIGHTS.countryMatch +
      0 * TEST_WEIGHTS.cityMatch;
    expect(result).toBe(expected);
  });

  test("should handle perfect match scenario", () => {
    const input: ScoringInput = {
      matchedSkills: 2,
      coverage: 1.0,
      domainOverlap: 1,
      countryMatch: 1,
      cityMatch: 1,
    };

    const result = calculateExplicitScore(input, TEST_WEIGHTS);

    const expected =
      2 * TEST_WEIGHTS.matchedSkills +
      1.0 * TEST_WEIGHTS.coverage +
      1 * TEST_WEIGHTS.domainOverlap +
      1 * TEST_WEIGHTS.countryMatch +
      1 * TEST_WEIGHTS.cityMatch;
    expect(result).toBe(expected);
  });

  test("should handle zero values", () => {
    const input: ScoringInput = {
      matchedSkills: 0,
      coverage: 0,
      domainOverlap: 0,
      countryMatch: 0,
      cityMatch: 0,
    };

    const result = calculateExplicitScore(input, TEST_WEIGHTS);
    expect(result).toBe(0);
  });

  test("should calculate with decimal precision", () => {
    const input: ScoringInput = {
      matchedSkills: 1,
      coverage: 0.75,
      domainOverlap: 0.5,
      countryMatch: 1,
      cityMatch: 0,
    };

    const result = calculateExplicitScore(input, TEST_WEIGHTS);

    const expected =
      1 * TEST_WEIGHTS.matchedSkills +
      0.75 * TEST_WEIGHTS.coverage +
      0.5 * TEST_WEIGHTS.domainOverlap +
      1 * TEST_WEIGHTS.countryMatch +
      0 * TEST_WEIGHTS.cityMatch;
    expect(result).toBe(expected);
  });

  test("should support custom weights", () => {
    const input: ScoringInput = {
      matchedSkills: 2,
      coverage: 0.5,
      domainOverlap: 1,
      countryMatch: 1,
      cityMatch: 1,
    };

    // Different weights to verify function flexibility
    const customWeights: ScoringWeights = {
      matchedSkills: 1,
      coverage: 0.5,
      domainOverlap: 0.2,
      countryMatch: 0.1,
      cityMatch: 0.05,
    };

    const result = calculateExplicitScore(input, customWeights);

    const expected =
      2 * customWeights.matchedSkills +
      0.5 * customWeights.coverage +
      1 * customWeights.domainOverlap +
      1 * customWeights.countryMatch +
      1 * customWeights.cityMatch;
    expect(result).toBe(expected);
  });
});
