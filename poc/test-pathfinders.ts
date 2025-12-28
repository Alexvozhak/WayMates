import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../src/core/routers/app.router.js";

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: "http://localhost:9000" })],
});

// Real trajectory from Kaggle user (3+ contexts for DTW)
const realUserTrajectory = [
  {
    contextId: "ctx_019b5a83-bc09-7611-aa6a-2876ea97340f",
    position: "senior",
    role: "developer",
    countryCode: "US",
    cityName: "New York",
    industry: "technology",
    domains: ["software"],
    skills: ["java"],
    citizenships: ["US"],
    languages: ["en"],
    createdAt: "2009-12-01T00:00:00Z",
    previousContextId: null,
    durationMonths: 22,
    creationReason: ["industry_changed"],
    birthYear: null,
    educationLevel: null,
    companySize: null,
    incomingTrails: [],
  },
  {
    contextId: "ctx_019b5a83-bc09-7611-aa6a-21a900a3e0d0",
    position: "senior",
    role: "developer",
    countryCode: "US",
    cityName: "New York",
    industry: "technology",
    domains: ["software"],
    skills: ["java", "python"],
    citizenships: ["US"],
    languages: ["en"],
    createdAt: "2011-10-01T00:00:00Z",
    previousContextId: "ctx_019b5a83-bc09-7611-aa6a-2876ea97340f",
    durationMonths: 4,
    creationReason: ["industry_changed"],
    birthYear: null,
    educationLevel: null,
    companySize: null,
    incomingTrails: [],
  },
  {
    contextId: "ctx_019b5a83-bc09-7611-aa6a-020350960ddd",
    position: "senior",
    role: "developer",
    countryCode: "US",
    cityName: "New York",
    industry: "technology",
    domains: ["software"],
    skills: ["java", "python", "aws"],
    citizenships: ["US"],
    languages: ["en"],
    createdAt: "2012-02-01T00:00:00Z",
    previousContextId: "ctx_019b5a83-bc09-7611-aa6a-21a900a3e0d0",
    durationMonths: 1,
    creationReason: ["position_changed", "industry_changed"],
    birthYear: null,
    educationLevel: null,
    companySize: null,
    incomingTrails: [],
  },
];

async function test() {
  try {
    console.log("=== Test: Pathfinders with DTW ===\n");

    const results = await client.search.pathfinders.query({
      userId: "usr_019b5a83-bc09-7611-aa69-f813718f2f66",
      referenceContext: {
        position: "junior",
        role: "developer",
      },
      targetContext: {
        position: { mode: "desired", values: ["senior", "lead"] },
      },
      userTrajectory: realUserTrajectory,
      excludedContextFields: [],
      excludedCreationReasons: [],
      targetRecencyMonths: null,
      referenceRecencyMonths: null,
      limit: 10,
      pathLimit: 5,
    });

    console.log(`Found ${results.length} pathfinders\n`);

    for (const r of results) {
      console.log(`User: ${r.userId}`);
      console.log(`  Path length: ${r.path.length}`);
      console.log(`  Trails: ${r.trails.length}`);
      console.log(`  DTW Total: ${r.dtwTotal ?? "N/A"}`);
      if (r.dtwMetrics) {
        console.log(
          `  DTW Metrics: shape=${r.dtwMetrics.shapeSimilarity.toFixed(2)}, tempo=${r.dtwMetrics.tempoSimilarity.toFixed(2)}, align=${r.dtwMetrics.alignmentScore.toFixed(2)}`,
        );
      }
      console.log();
    }

    // Verify DTW is present
    const withDtw = results.filter((r) => r.dtwTotal !== undefined);
    console.log(`✅ ${withDtw.length}/${results.length} have DTW metrics`);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
  }
}

test();
