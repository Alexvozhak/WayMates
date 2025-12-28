/**
 * Chart Service Smoke Test - OOP Architecture
 *
 * Tests the refactored OOP chart module:
 * - TrajectoryTransformer
 * - OverlapCalculator
 * - ChartBuilder
 * - HtmlRenderer
 */

import fs from "node:fs";
import { ChartBuilder } from "../src/chart/builders/chart-builder.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";

// ==========================================
// === LOAD FIXTURES ===
// ==========================================

const U1 = JSON.parse(fs.readFileSync("tests/core/fixtures/U1.json", "utf-8"));
const U2 = JSON.parse(fs.readFileSync("tests/core/fixtures/U2.json", "utf-8"));
const U3 = JSON.parse(fs.readFileSync("tests/core/fixtures/U3.json", "utf-8"));

console.log("✅ Loaded fixtures from tests/core/fixtures/:");
console.log(`   U1: ${U1.contexts.length} contexts (${U1.userId})`);
console.log(`   U2: ${U2.contexts.length} contexts (${U2.userId})`);
console.log(`   U3: ${U3.contexts.length} contexts (${U3.userId})`);

// ==========================================
// === PREPARE DATA ===
// ==========================================

const userTrajectory: UserContext[] = U1.contexts;

const candidates: ScoredMatchedCandidate[] = [
  {
    userId: U2.userId,
    matchedContext: U2.contexts[U2.contexts.length - 1]!,
    timeSinceMatchedMonths: 6,
    contextMatchScore: 85,
    candidateType: "pathfinder",
    path: U2.contexts,
    dtwMetrics: {
      shapeSimilarity: 0.87,
      tempoSimilarity: 0.91,
      stabilityScore: 0.82,
    },
    dtwTotal: 2.6,
  },
  {
    userId: U3.userId,
    matchedContext: U3.contexts[U3.contexts.length - 1]!,
    timeSinceMatchedMonths: 12,
    contextMatchScore: 78,
    candidateType: "waymate",
    path: U3.contexts,
    dtwMetrics: {
      shapeSimilarity: 0.75,
      tempoSimilarity: 0.8,
      stabilityScore: 0.7,
    },
    dtwTotal: 2.25,
  },
];

console.log("\n✅ Prepared test data:");
console.log(`   User trajectory: ${userTrajectory.length} contexts`);
console.log(`   Candidates: ${candidates.length} (1 pathfinder, 1 waymate)`);

// ==========================================
// === DEFINE GOAL VALUES ===
// ==========================================

// User's goal: Middle position in frontend domain (matches U2 pathfinder)
const goalValues = {
  position: "middle",
  domains: "frontend",
};

console.log("\n🎯 Goal values (for horizontal lines):");
console.log(`   position: ${goalValues.position} (pathfinder reached this)`);
console.log(`   domains: ${goalValues.domains}`);

// ==========================================
// === BUILD CHART (OOP) ===
// ==========================================

console.log("\n⏳ Building chart with OOP architecture...");

const builder = new ChartBuilder({
  mode: "full",
  userTrajectory,
  candidates,
  fields: DEFAULT_FIELDS,
  locale: "ru",
  existingGoal: true,
  goalValues,
});

const html = builder.build();

// ==========================================
// === SAVE TO FILE ===
// ==========================================

const outputPath = "poc/chart-output.html";
fs.writeFileSync(outputPath, html, "utf-8");

console.log(`\n✅ Chart generated successfully!`);
console.log(`   Output: ${outputPath}`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);

console.log("\n📊 OOP Architecture:");
console.log("   ✅ TrajectoryTransformer");
console.log("   ✅ OverlapCalculator");
console.log("   ✅ ChartBuilder (orchestrator)");
console.log("   ✅ HtmlRenderer");

console.log("\n📊 Features:");
console.log("   ✅ Controls (aspect + candidate checkboxes)");
console.log("   ✅ Main chart (Plotly multi-subplot)");
console.log("   ✅ Goal horizontal lines (dashed gold)");
console.log("   ✅ Pathfinder stars (only if goal exists)");
console.log("   ✅ Overlap Timeline (integrated as subplot)");
console.log("   ✅ Spider chart (DTW metrics)");
console.log("   ✅ Metrics table");
console.log("   ✅ Export PNG button");
console.log("   ✅ Connection lines toggle");

console.log("\n🔗 Открыть в браузере:");
console.log(`   open ${outputPath}`);
console.log(`   firefox ${outputPath}`);
