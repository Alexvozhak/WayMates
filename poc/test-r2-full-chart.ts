/**
 * Full Chart R2 Upload Test
 */

import "dotenv/config";
import fs from "node:fs";
import { ChartBuilder } from "../src/chart/builders/chart-builder.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";
import { getR2Config, R2StorageService } from "../src/chart/services/r2-storage.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";

async function testFullChartUpload(): Promise<void> {
  console.log("🧪 Full Chart R2 Upload Test\n");

  // Load fixtures
  const U1 = JSON.parse(fs.readFileSync("tests/core/fixtures/U1.json", "utf-8"));
  const U2 = JSON.parse(fs.readFileSync("tests/core/fixtures/U2.json", "utf-8"));
  const U3 = JSON.parse(fs.readFileSync("tests/core/fixtures/U3.json", "utf-8"));

  console.log("1️⃣ Loaded fixtures");

  // Prepare data
  const userTrajectory: UserContext[] = U1.contexts;
  const candidates: ScoredMatchedCandidate[] = [
    {
      userId: U2.userId,
      matchedContext: U2.contexts[U2.contexts.length - 1]!,
      timeSinceMatchedMonths: 6,
      contextMatchScore: 85,
      candidateType: "pathfinder",
      path: U2.contexts,
      dtwMetrics: { shapeSimilarity: 0.87, tempoSimilarity: 0.91, stabilityScore: 0.82 },
      dtwTotal: 2.6,
    },
    {
      userId: U3.userId,
      matchedContext: U3.contexts[U3.contexts.length - 1]!,
      timeSinceMatchedMonths: 12,
      contextMatchScore: 78,
      candidateType: "waymate",
      path: U3.contexts,
      dtwMetrics: { shapeSimilarity: 0.75, tempoSimilarity: 0.8, stabilityScore: 0.7 },
      dtwTotal: 2.25,
    },
  ];

  const goalValues = { position: "middle", domains: "frontend" };

  // Build chart
  console.log("2️⃣ Building chart...");
  const builder = new ChartBuilder({
    userTrajectory,
    candidates,
    fields: DEFAULT_FIELDS,
    locale: "ru",
    existingGoal: true,
    goalValues,
  });

  const html = builder.build();
  console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);

  // Upload to R2
  console.log("3️⃣ Uploading to R2...");
  const config = getR2Config();
  const storage = new R2StorageService(config);
  const result = await storage.upload(html);

  console.log(`\n🎉 SUCCESS!`);
  console.log(`\n🔗 Chart URL:\n   ${result.url}`);
  console.log(`\n📅 Expires: ${result.expiresAt}`);
}

testFullChartUpload().catch((error) => {
  console.error("❌ FAILED:", error);
  process.exit(1);
});
