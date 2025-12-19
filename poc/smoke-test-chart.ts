/**
 * Chart Service Smoke Test - Full test with Overlap Timeline
 *
 * Цель: Проверить HTML генерацию с Overlap Timeline visualization
 *
 * Шаги:
 * 1. Загрузить фикстуры U1, U2, U3 из tests/core/fixtures/
 * 2. Создать моки ScoredMatchedCandidate
 * 3. Вызвать transformToTrajectories + calculateSimilarity + calculateAllOverlapSummaries
 * 4. Сохранить в /tmp/chart-test.html
 * 5. Открыть в браузере для проверки
 */

import fs from "node:fs";
import { transformToTrajectories } from "../src/chart/services/data-transformer.js";
import { calculateAllOverlapSummaries, calculateSimilarity } from "../src/chart/services/overlap-calculator.js";
import { generateChartHtml } from "../src/chart/templates/chart-html.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";
import type { ChartPageData } from "../src/chart/templates/chart-html.js";

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

// User trajectory (U1: junior → middle)
const userTrajectory: UserContext[] = U1.contexts;

// Mock candidates from U2, U3
const candidates: ScoredMatchedCandidate[] = [
  {
    // Pathfinder #1 - достиг middle (current context)
    userId: U2.userId,
    matchedContext: U2.contexts[U2.contexts.length - 1]!, // current context
    timeSinceMatchedMonths: 6,
    contextMatchScore: 85,
    candidateType: "pathfinder",
    path: U2.contexts, // full trajectory
    dtwMetrics: {
      shapeSimilarity: 0.87,
      tempoSimilarity: 0.91,
      stabilityScore: 0.82,
    },
    dtwTotal: 2.6,
  },
  {
    // Waymate #2 - та же цель (middle frontend)
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
// === TRANSFORM DATA ===
// ==========================================

console.log("\n⏳ Transforming data...");
const trajectories = transformToTrajectories(userTrajectory, candidates, "ru", true);

console.log(`✅ Transformed to ${trajectories.length} trajectories:`);
for (const traj of trajectories) {
  console.log(`   - ${traj.label}: ${traj.points.length} points, color ${traj.color}, width ${traj.width}`);
  if (traj.matchedContextIndex !== undefined) {
    console.log(`     └─ ⭐ Matched context at index ${traj.matchedContextIndex}`);
  }
}

// ==========================================
// === CALCULATE METRICS ===
// ==========================================

console.log("\n⏳ Calculating similarity metrics...");
const metrics = candidates.map((candidate, index) => calculateSimilarity(trajectories[index + 1]!, candidate));

console.log(`✅ Calculated metrics for ${metrics.length} candidates:`);
for (const metric of metrics) {
  console.log(`   - Candidate ${metric.candidateId}: overall=${metric.overall.toFixed(2)}`);
}

// ==========================================
// === CALCULATE OVERLAP SUMMARIES ===
// ==========================================

console.log("\n⏳ Calculating full overlap periods...");
const userTraj = trajectories[0]!;
const candidateTrajs = trajectories.slice(1);
const overlapSummaries = calculateAllOverlapSummaries(userTraj, candidateTrajs, DEFAULT_FIELDS);

console.log(`✅ Calculated overlap summaries for ${overlapSummaries.length} candidates:`);
for (const summary of overlapSummaries) {
  console.log(`   - ${summary.candidateLabel}: ${summary.periods.length} periods`);
  console.log(`     └─ Total: ${summary.totalDays} days, Longest streak: ${summary.longestStreakDays} days`);
}

// ==========================================
// === CALCULATE TIME RANGE ===
// ==========================================

const allTimestamps = trajectories.flatMap((t) => t.points.map((p) => p.timestamp));
const timeRange = {
  minTime: Math.min(...allTimestamps),
  maxTime: Math.max(...allTimestamps),
};

console.log(
  `\n✅ Time range: ${new Date(timeRange.minTime).toISOString().split("T")[0]} → ${new Date(timeRange.maxTime).toISOString().split("T")[0]}`,
);

// ==========================================
// === GENERATE HTML ===
// ==========================================

console.log("\n⏳ Generating HTML...");
const chartData: ChartPageData = {
  trajectories,
  fields: DEFAULT_FIELDS,
  selectedFields: DEFAULT_FIELDS,
  metrics,
  overlapSummaries,
  timeRange,
  locale: "ru",
};

const html = generateChartHtml(chartData);

// ==========================================
// === SAVE TO FILE ===
// ==========================================

const outputPath = "poc/chart-output-v1.html";
fs.writeFileSync(outputPath, html, "utf-8");

console.log(`\n✅ Chart generated successfully!`);
console.log(`   Output: ${outputPath} (в репозитории, не в /tmp)`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);

console.log("\n📊 Визуализация включает:");
console.log("   ✅ Controls (checkboxes для выбора аспектов)");
console.log("   ✅ Main chart (Plotly multi-subplot)");
console.log("   ✅ Overlap Timeline (штриховые полоски совпадений)");
console.log("   ✅ Metrics table (DTW scores)");

console.log("\n🔗 Открыть в браузере:");
console.log(`   open ${outputPath}`);
console.log(`   firefox ${outputPath}`);
