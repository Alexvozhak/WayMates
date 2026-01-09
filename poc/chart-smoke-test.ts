/**
 * Smoke test for FEAT-048 Universal Chart API.
 * Tests all 3 chart modes with REAL fixture data and REAL DTW calculation.
 *
 * Run: set -a && source .env.test && set +a && npx tsx poc/chart-smoke-test.ts
 */

import { readFileSync } from "node:fs";
import { generateTrajectoryChart } from "../src/chart/index.js";
import { TrajectorySimilarityService } from "../src/core/trajectory-similarity.service.js";

import type { ChartCandidate } from "../src/chart/index.js";
import type { UserContext, AdhocContextBase, DTWMetrics } from "../src/shared/schemas.js";

const dtwService = new TrajectorySimilarityService();

type FixtureContext = {
  contextId: string;
  createdAt: string;
  position: string;
  role: string;
  domains: string[];
  skills?: string[];
  countryCode: string;
  cityName?: string;
  industry?: string;
  companySize?: string;
  birthYear?: number;
  educationLevel?: string;
  citizenships?: string[];
  creationReason?: string[];
};

type FixtureTrail = {
  trailId: string;
  skill: string;
  platform: string;
  fromContextId: string;
  toContextId: string;
  totalDurationWeeks: number;
  courseName?: string;
};

type Fixture = {
  userId: string;
  contexts: FixtureContext[];
  trails?: FixtureTrail[];
};

function loadFixture(name: string): Fixture {
  const path = `tests/core/fixtures/${name}.json`;
  return JSON.parse(readFileSync(path, "utf-8")) as Fixture;
}

function toUserContext(ctx: FixtureContext): UserContext {
  return {
    contextId: ctx.contextId,
    createdAt: ctx.createdAt,
    position: ctx.position,
    role: ctx.role,
    domains: ctx.domains,
    skills: ctx.skills ?? [],
    countryCode: ctx.countryCode,
    cityName: ctx.cityName ?? null,
    industry: ctx.industry ?? null,
    companySize: ctx.companySize ?? null,
    birthYear: ctx.birthYear ?? null,
    educationLevel: ctx.educationLevel ?? null,
    citizenships: ctx.citizenships ?? [],
    creationReason: ctx.creationReason?.[0] ?? "started_working",
  } as UserContext;
}

type CandidateOptions = {
  userTrajectory?: UserContext[];
};

function toCandidate(fixture: Fixture, matchedIdx: number, options: CandidateOptions = {}): ChartCandidate {
  const path = fixture.contexts.map(toUserContext);
  const matched = path[matchedIdx];
  const createdAt = new Date(matched.createdAt);
  const monthsSince = Math.floor((Date.now() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));

  const base: ChartCandidate = {
    userId: fixture.userId,
    matchedContext: matched,
    candidateType: "waymate",
    timeSinceMatchedMonths: monthsSince,
    path,
    trails: (fixture.trails ?? []).map((t) => ({
      trailId: t.trailId,
      skill: t.skill,
      platform: t.platform,
      fromContextId: t.fromContextId,
      toContextId: t.toContextId,
      totalDurationWeeks: t.totalDurationWeeks,
      courseName: t.courseName ?? null,
      ratingCourse: null,
      ratingPlatform: null,
    })),
  };

  // Compute real DTW if user trajectory provided
  if (options.userTrajectory && options.userTrajectory.length > 0) {
    const dtwMetrics: DTWMetrics = dtwService.computeDTWMetrics(options.userTrajectory, path);
    const dtwTotal = dtwMetrics.shapeSimilarity + dtwMetrics.tempoSimilarity + dtwMetrics.alignmentScore;
    return { ...base, dtwMetrics, dtwTotal };
  }

  return base;
}

function toAdhocContext(ctx: FixtureContext): AdhocContextBase {
  return {
    position: ctx.position,
    role: ctx.role,
    domains: ctx.domains,
    skills: ctx.skills ?? null,
    countryCode: ctx.countryCode,
    cityName: ctx.cityName ?? null,
    industry: ctx.industry ?? null,
    companySize: ctx.companySize ?? null,
    birthYear: ctx.birthYear ?? null,
    educationLevel: ctx.educationLevel ?? null,
    citizenships: ctx.citizenships ?? null,
    languages: null,
  };
}

const positionOrder = ["intern", "junior", "middle", "senior", "lead", "principal", "director"];

async function testFullMode(userFixture: Fixture, candidateFixture: Fixture): Promise<string | null> {
  console.log("\n[TEST] Full mode (userTrajectory + candidates + REAL DTW)...");
  console.log(`  User: ${userFixture.userId} (${userFixture.contexts.length} contexts)`);
  console.log(`  Candidate: ${candidateFixture.userId} (${candidateFixture.contexts.length} contexts)`);

  try {
    const userTrajectory = userFixture.contexts.map(toUserContext);
    const candidate = toCandidate(candidateFixture, candidateFixture.contexts.length - 1, { userTrajectory });

    // Log computed DTW
    if ("dtwMetrics" in candidate && candidate.dtwMetrics) {
      const m = candidate.dtwMetrics;
      console.log(
        `  DTW (computed): shape=${m.shapeSimilarity.toFixed(2)}, tempo=${m.tempoSimilarity.toFixed(2)}, alignment=${m.alignmentScore.toFixed(2)}`,
      );
    }

    const result = await generateTrajectoryChart({
      mode: "full",
      userTrajectory,
      candidates: [candidate],
      maxCandidates: 5,
      positionOrder,
      locale: "ru",
      existingGoal: true,
      goalValues: { position: "senior", domains: "backend" },
    });
    console.log(`  ✅ Chart URL: ${result.chartUrl}`);
    return result.chartUrl;
  } catch (error) {
    console.error(`  ❌ Failed:`, error);
    return null;
  }
}

async function testCandidatesOnlyMode(adhocFixture: Fixture, candidateFixture: Fixture): Promise<string | null> {
  console.log("\n[TEST] Candidates-only mode (adhocContext + candidates)...");
  console.log(`  Adhoc from: ${adhocFixture.userId}`);
  console.log(`  Candidate: ${candidateFixture.userId}`);

  try {
    const adhocContext = toAdhocContext(adhocFixture.contexts[0]);
    const candidate = toCandidate(candidateFixture, candidateFixture.contexts.length - 1);

    const result = await generateTrajectoryChart({
      mode: "candidates-only",
      adhocContext,
      candidates: [candidate],
      maxCandidates: 5,
      positionOrder,
      locale: "ru",
      existingGoal: false,
    });
    console.log(`  ✅ Chart URL: ${result.chartUrl}`);
    return result.chartUrl;
  } catch (error) {
    console.error(`  ❌ Failed:`, error);
    return null;
  }
}

async function testGoalOnlyMode(candidateFixture: Fixture): Promise<string | null> {
  console.log("\n[TEST] Goal-only mode (only candidates + goal line)...");
  console.log(`  Candidate: ${candidateFixture.userId}`);
  console.log(`  Goal: senior backend`);

  try {
    const candidate = toCandidate(candidateFixture, candidateFixture.contexts.length - 1);

    const result = await generateTrajectoryChart({
      mode: "goal-only",
      candidates: [candidate],
      maxCandidates: 5,
      positionOrder,
      locale: "ru",
      existingGoal: true,
      goalValues: { position: "senior", domains: "backend" },
    });
    console.log(`  ✅ Chart URL: ${result.chartUrl}`);
    return result.chartUrl;
  } catch (error) {
    console.error(`  ❌ Failed:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  console.log("=== FEAT-048 Chart Smoke Test (Real Fixtures) ===");

  // Load fixtures
  const u5 = loadFixture("U5"); // middle → senior, frontend, 2 contexts
  const u10 = loadFixture("U10"); // junior → middle → senior, backend, 3 contexts + trails

  console.log("\n--- Loaded Fixtures ---");
  console.log(`U5: ${u5.contexts.length} contexts, ${u5.trails?.length ?? 0} trails`);
  console.log(`U10: ${u10.contexts.length} contexts, ${u10.trails?.length ?? 0} trails`);

  // Run tests
  const urls: (string | null)[] = [];
  urls.push(await testFullMode(u5, u10));
  urls.push(await testCandidatesOnlyMode(u5, u10));
  urls.push(await testGoalOnlyMode(u10));

  const passed = urls.filter(Boolean).length;
  const total = urls.length;

  console.log(`\n=== Results: ${passed}/${total} passed ===`);

  if (passed === total) {
    console.log("\n✅ All smoke tests passed!");
    console.log("\n--- Visual Verification URLs ---");
    console.log("Open these URLs to verify charts render correctly:\n");
    urls.forEach((url, i) => {
      const modes = ["full", "candidates-only", "goal-only"];
      console.log(`${modes[i]}: ${url}`);
    });
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
