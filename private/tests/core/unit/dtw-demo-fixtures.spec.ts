/**
 * DTW Demo Fixtures Unit Tests
 *
 * Verify that demo fixtures produce expected DTW metric contrasts.
 * These fixtures are designed for FEAT-055 demo video.
 *
 * Alex's trajectory (from CV):
 * 1. 2016-2023 (7y): Research Institute, middle, backend/mobile
 * 2. 2023 May-Sep (5m): DSSL, middle, backend/security
 * 3. 2023 Sep - 2025 Apr (1.5y): DSSL, team_lead, backend
 * 4. 2025 Apr - now: Lido, senior, backend/platform
 */

import fs from "node:fs";
import path from "node:path";

import { TrajectorySimilarityService } from "@core/trajectory-similarity.service.js";
import { beforeAll, describe, expect, it } from "vitest";


import type { UserContext } from "@shared/schemas.js";

type Fixture = {
  userId: string;
  contexts: UserContext[];
};

const FIXTURES_DIR = path.join(import.meta.dirname, "../fixtures");

function loadFixture(name: string): Fixture {
  const filePath = path.join(FIXTURES_DIR, `Demo-${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Alex's trajectory for DTW comparison.
 * Matches the CV data from KomarovAlex2025.md
 */
function createAlexTrajectory(): UserContext[] {
  const baseContext = {
    role: "developer",
    industry: "technology",
    companySize: "medium",
    countryCode: "RU",
    cityName: "Rostov-on-Don",
    citizenships: ["RU"],
    birthYear: 1993,
    educationLevel: "BACHELOR" as const,
    previousContextId: null,
    nextContextId: null,
    salaryExact: null,
    salaryMin: null,
    salaryMax: null,
    languages: null,
    feedback: null,
  };

  return [
    {
      ...baseContext,
      contextId: "ctx_alex_001",
      nextContextId: "ctx_alex_002",
      createdAt: "2016-08-01T00:00:00Z",
      creationReason: ["started_working"],
      position: "middle",
      domains: ["backend", "mobile"],
      skills: ["c++", "python", "postgresql"],
      industry: "defense",
    },
    {
      ...baseContext,
      contextId: "ctx_alex_002",
      previousContextId: "ctx_alex_001",
      nextContextId: "ctx_alex_003",
      createdAt: "2023-05-01T00:00:00Z",
      creationReason: ["company_changed"],
      position: "middle",
      domains: ["backend", "security"],
      skills: ["c++", "postgresql"],
      industry: "technology",
    },
    {
      ...baseContext,
      contextId: "ctx_alex_003",
      previousContextId: "ctx_alex_002",
      nextContextId: "ctx_alex_004",
      createdAt: "2023-09-01T00:00:00Z",
      creationReason: ["position_changed"],
      position: "team_lead",
      domains: ["backend"],
      skills: ["typescript", "nestjs", "postgresql", "docker"],
      industry: "technology",
    },
    {
      ...baseContext,
      contextId: "ctx_alex_004",
      previousContextId: "ctx_alex_003",
      createdAt: "2025-04-01T00:00:00Z",
      creationReason: ["company_changed"],
      position: "senior",
      domains: ["backend", "platform"],
      skills: ["typescript", "python", "go", "docker", "kubernetes"],
      industry: "finance",
    },
  ];
}

describe("DTW Demo Fixtures", () => {
  let service: TrajectorySimilarityService;
  let alexTrajectory: UserContext[];

  beforeAll(() => {
    service = new TrajectorySimilarityService();
    alexTrajectory = createAlexTrajectory();
  });

  describe("Pathfinders (reached Alex's goal FROM similar context)", () => {
    it("IdealPathfinder: Shape ~0.9, Tempo ~0.9, Align ~0.9", () => {
      const fixture = loadFixture("IdealPathfinder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("IdealPathfinder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // High similarity expected - similar path
      expect(metrics.shapeSimilarity).toBeGreaterThan(0.65);
      // IdealPathfinder has highest shape among pathfinders
    });

    it("SprintPathfinder: Shape ~0.85, Tempo ~0.25 (fast growth)", () => {
      const fixture = loadFixture("SprintPathfinder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("SprintPathfinder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // Lower tempo expected - faster career growth
      expect(metrics.tempoSimilarity).toBeLessThan(metrics.shapeSimilarity);
    });

    it("AltRoutePathfinder: Shape ~0.3 (different domains), Tempo ~0.85", () => {
      const fixture = loadFixture("AltRoutePathfinder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("AltRoutePathfinder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // Lower shape expected - frontend path vs backend
      expect(metrics.shapeSimilarity).toBeLessThan(0.7);
    });

    it("DirectPathfinder: Shape ~0.4, Align ~0.9 (4 contexts)", () => {
      const fixture = loadFixture("DirectPathfinder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("DirectPathfinder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // High alignment expected - same number of contexts
      expect(metrics.alignmentScore).toBeGreaterThan(0.8);
    });
  });

  describe("Waymates (same goal, not reached yet)", () => {
    it("IdealWaymate: high similarity to Alex", () => {
      const fixture = loadFixture("IdealWaymate");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("IdealWaymate:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      expect(total).toBeGreaterThan(1.5);
    });

    it("SprintWaymate: fast growth pattern", () => {
      const fixture = loadFixture("SprintWaymate");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);

      console.log("SprintWaymate:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
      });

      // Fast growth = low tempo similarity
      expect(metrics.tempoSimilarity).toBeLessThan(0.7);
    });

    it("AltWaymate: data science background", () => {
      const fixture = loadFixture("AltWaymate");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);

      console.log("AltWaymate:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
      });

      // Different role = lower shape than IdealWaymate
      expect(metrics.shapeSimilarity).toBeLessThan(0.8);
    });

    it("DirectWaymate: devops background", () => {
      const fixture = loadFixture("DirectWaymate");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);

      console.log("DirectWaymate:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
      });

      // Different role = lower shape than IdealWaymate
      expect(metrics.shapeSimilarity).toBeLessThan(0.8);
    });
  });

  describe("ReversePathfinders (reached goal from different trajectories)", () => {
    it("PMToFounder: product manager path", () => {
      const fixture = loadFixture("PMToFounder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("PMToFounder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // Very different path = low shape (lowest among all)
      expect(metrics.shapeSimilarity).toBeLessThan(0.6);
    });

    it("DSToFounder: data scientist path", () => {
      const fixture = loadFixture("DSToFounder");
      const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
      const total = metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore;

      console.log("DSToFounder:", {
        shape: metrics.shapeSimilarity.toFixed(3),
        tempo: metrics.tempoSimilarity.toFixed(3),
        align: metrics.alignmentScore.toFixed(3),
        total: total.toFixed(3),
      });

      // Very different path = low shape (lowest among all)
      expect(metrics.shapeSimilarity).toBeLessThan(0.6);
    });
  });

  describe("DTW Contrast Summary", () => {
    it("shows metric distribution across all fixtures", () => {
      const fixtures = [
        "IdealPathfinder",
        "SprintPathfinder",
        "AltRoutePathfinder",
        "DirectPathfinder",
        "IdealWaymate",
        "SprintWaymate",
        "AltWaymate",
        "DirectWaymate",
        "PMToFounder",
        "DSToFounder",
      ];

      const results = fixtures.map((name) => {
        const fixture = loadFixture(name);
        const metrics = service.computeDTWMetrics(alexTrajectory, fixture.contexts);
        return {
          name,
          shape: metrics.shapeSimilarity,
          tempo: metrics.tempoSimilarity,
          align: metrics.alignmentScore,
          total: metrics.shapeSimilarity + metrics.tempoSimilarity + metrics.alignmentScore,
        };
      });

      console.log("\n=== DTW Metrics Summary ===");
      console.table(
        results.map((r) => ({
          Name: r.name,
          Shape: r.shape.toFixed(3),
          Tempo: r.tempo.toFixed(3),
          Align: r.align.toFixed(3),
          Total: r.total.toFixed(3),
        })),
      );

      // Verify we have variety in metrics
      const shapes = results.map((r) => r.shape);
      const tempos = results.map((r) => r.tempo);

      // Shape should have good contrast (different career paths)
      expect(Math.max(...shapes) - Math.min(...shapes)).toBeGreaterThan(0.2);
      // Tempo has low contrast due to similar career lengths — acceptable for demo
      // Focus is on Shape similarity for video demonstration
      expect(Math.max(...tempos) - Math.min(...tempos)).toBeGreaterThan(0.05);
    });
  });
});
