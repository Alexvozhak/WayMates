/**
 * Chart Service Smoke Test v2 - With Realistic Overlap Data
 *
 * Fixtures:
 * - User: junior → middle → senior (berlin, frontend, tech)
 * - #1 (Pathfinder): same path + lead, 1 month offset
 * - #2 (Waymate): same path but relocated to munich at senior
 */

import fs from "node:fs";
import { exec } from "node:child_process";
import path from "node:path";
import { transformToTrajectories } from "../src/chart/services/data-transformer.js";
import { calculateAllOverlapSummaries, calculateSimilarity } from "../src/chart/services/overlap-calculator.js";
import { generateChartHtmlV2 } from "../src/chart/templates/chart-html-v2.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";
import type { ChartPageDataV2 } from "../src/chart/templates/chart-html-v2.js";

// ==========================================
// === LOAD FIXTURES ===
// ==========================================

const User = JSON.parse(fs.readFileSync("tests/fixtures/chart-demo-user.json", "utf-8"));
const Cand1 = JSON.parse(fs.readFileSync("tests/fixtures/chart-demo-candidate1.json", "utf-8"));
const Cand2 = JSON.parse(fs.readFileSync("tests/fixtures/chart-demo-candidate2.json", "utf-8"));

console.log("✅ Loaded chart demo fixtures:");
console.log(`   User: ${User.contexts.length} contexts (junior → middle → senior)`);
console.log(`   #1 Pathfinder: ${Cand1.contexts.length} contexts (junior → middle → senior → lead)`);
console.log(`   #2 Waymate: ${Cand2.contexts.length} contexts (junior → middle → senior, relocated to munich)`);

// ==========================================
// === TIMELINE OVERVIEW ===
// ==========================================

console.log("\n📅 Timeline:");
console.log("   User:  Jan'23 ──────── Jul'23 ──────── Jan'24");
console.log("          junior         middle          senior");
console.log("          berlin         berlin          berlin");
console.log("");
console.log("   #1:    Feb'23 ──────── Aug'23 ──────── Feb'24 ──────── Sep'24");
console.log("          junior         middle          senior          lead ⭐");
console.log("          berlin         berlin          berlin          berlin");
console.log("");
console.log("   #2:    Mar'23 ──────── Sep'23 ──────── Mar'24");
console.log("          junior         middle          senior");
console.log("          berlin         berlin          MUNICH ← relocated!");

// ==========================================
// === PREPARE DATA ===
// ==========================================

const userTrajectory: UserContext[] = User.contexts;

const candidates: ScoredMatchedCandidate[] = [
  {
    userId: Cand1.userId,
    matchedContext: Cand1.contexts[2]!, // senior context (goal reached)
    timeSinceMatchedMonths: 7,
    contextMatchScore: 92,
    candidateType: "pathfinder",
    path: Cand1.contexts,
    dtwMetrics: {
      shapeSimilarity: 0.95,
      tempoSimilarity: 0.88,
      stabilityScore: 0.91,
    },
    dtwTotal: 2.74,
  },
  {
    userId: Cand2.userId,
    matchedContext: Cand2.contexts[2]!,
    timeSinceMatchedMonths: 9,
    contextMatchScore: 78,
    candidateType: "waymate",
    path: Cand2.contexts,
    dtwMetrics: {
      shapeSimilarity: 0.82,
      tempoSimilarity: 0.75,
      stabilityScore: 0.68,
    },
    dtwTotal: 2.25,
  },
];

console.log("\n✅ Prepared candidates:");
console.log(`   #1 Pathfinder: matched at senior, score=${candidates[0]!.contextMatchScore}`);
console.log(`   #2 Waymate: matched at senior (munich), score=${candidates[1]!.contextMatchScore}`);

// ==========================================
// === TRANSFORM DATA ===
// ==========================================

console.log("\n⏳ Transforming data...");
const trajectories = transformToTrajectories(userTrajectory, candidates, "ru", true);

console.log(`✅ Transformed to ${trajectories.length} trajectories`);

// ==========================================
// === CALCULATE METRICS ===
// ==========================================

console.log("\n⏳ Calculating metrics...");
const metrics = candidates.map((candidate, index) => calculateSimilarity(trajectories[index + 1]!, candidate));

// ==========================================
// === CALCULATE OVERLAP (server-side preview) ===
// ==========================================

console.log("\n⏳ Calculating overlaps (server-side)...");
const userTraj = trajectories[0]!;
const candidateTrajs = trajectories.slice(1);
const overlapSummaries = calculateAllOverlapSummaries(userTraj, candidateTrajs, DEFAULT_FIELDS);

console.log("✅ Expected overlaps:");
for (const summary of overlapSummaries) {
  console.log(`   ${summary.candidateLabel}: ${summary.totalDays} days total, ${summary.longestStreakDays} days max`);
  if (summary.periods.length > 0) {
    for (const p of summary.periods) {
      const start = new Date(p.startTime).toISOString().split("T")[0];
      const end = new Date(p.endTime).toISOString().split("T")[0];
      console.log(`     └─ ${start} → ${end}`);
    }
  }
}

// ==========================================
// === CALCULATE TIME RANGE ===
// ==========================================

const allTimestamps = trajectories.flatMap((t) => t.points.map((p) => p.timestamp));
const timeRange = {
  minTime: Math.min(...allTimestamps),
  maxTime: Math.max(...allTimestamps),
};

// ==========================================
// === GENERATE HTML V2 ===
// ==========================================

console.log("\n⏳ Generating HTML v2...");
const chartData: ChartPageDataV2 = {
  trajectories,
  fields: DEFAULT_FIELDS,
  selectedFields: DEFAULT_FIELDS,
  metrics,
  overlapSummaries,
  timeRange,
  locale: "ru",
};

const html = generateChartHtmlV2(chartData);

// ==========================================
// === SAVE TO FILE ===
// ==========================================

const outputPath = "poc/chart-output-v2.html";
fs.writeFileSync(outputPath, html, "utf-8");

console.log(`\n✅ Chart v2 generated!`);
console.log(`   Output: ${outputPath}`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);

// Auto-open in browser (detached, won't block)
const absolutePath = path.resolve(outputPath);
const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
const child = exec(`${openCmd} "${absolutePath}"`);
child.unref();
console.log("🌐 Opening in browser...");
