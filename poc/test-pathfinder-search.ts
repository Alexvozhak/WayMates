/**
 * Quick test for pathfinder search debugging
 * Run: set -a && source .env.test && set +a && npx tsx poc/test-pathfinder-search.ts
 */

import { CoreClient } from "../src/facade/core-client.js";

const coreClient = new CoreClient(process.env.CORE_API_URL ?? "http://localhost:3001");
const client = coreClient.client;

const referenceContext = {
  position: "technical project manager",
  role: "manager",
  domains: ["management", "backend"],
  skills: ["typescript", "docker"],
  industry: "fintech",
  companySize: "large",
  cityName: "rostov-on-don",
  countryCode: "RU",
  citizenships: ["RU"],
  birthYear: null,
  educationLevel: null,
  languages: null,
};

const targetContext = {
  position: { mode: "desired" as const, values: ["head of engineering"] },
  role: { mode: "desired" as const, values: ["manager"] },
  countries: { mode: "desired" as const, values: ["NL"] },
  domains: { mode: "desired" as const, values: ["ai"] },
};

async function main() {
  console.log("Testing pathfinder search...\n");
  console.log("Reference context:", JSON.stringify(referenceContext, null, 2));
  console.log("Target context:", JSON.stringify(targetContext, null, 2));

  try {
    const results = await client.search.pathfinders.query({
      userId: "usr_019b0055-0000-7000-8000-000000000001", // Demo Alex user
      referenceContext,
      targetContext,
      excludedContextFields: ["cityName", "companySize", "birthYear", "educationLevel", "languages"],
      excludedCreationReasons: [],
      referenceRecencyMonths: null,
      targetRecencyMonths: null,
      limit: 10,
      pathLimit: 5,
    });

    console.log("\nResults:", results.length, "pathfinders found");
    for (const r of results) {
      console.log(`- ${r.userId}: ${r.matchedContext.position} → ${r.targetContext.position}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
