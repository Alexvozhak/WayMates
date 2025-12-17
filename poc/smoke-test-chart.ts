/**
 * Chart Service Smoke Test - Phase 0: Local HTML (без R2)
 *
 * Цель: Проверить HTML генерацию и структуру до настройки R2
 *
 * Шаги:
 * 1. Загрузить фикстуры U1, U2, U3
 * 2. Создать моки ScoredMatchedCandidate
 * 3. Вызвать transformToTrajectories + calculateSimilarity + generateChartHtml
 * 4. Сохранить в /tmp/chart-test.html
 * 5. Открыть в браузере для проверки
 */

import fs from "node:fs";
import { transformToTrajectories } from "../src/chart/services/data-transformer.js";
import { calculateSimilarity } from "../src/chart/services/overlap-calculator.js";
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

console.log("✅ Loaded fixtures:");
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
// === GENERATE HTML ===
// ==========================================

console.log("\n⏳ Generating HTML...");
const chartData: ChartPageData = {
  trajectories,
  fields: DEFAULT_FIELDS,
  selectedFields: DEFAULT_FIELDS,
  metrics,
  locale: "ru",
};

const html = generateChartHtml(chartData);

// ==========================================
// === SAVE TO FILE ===
// ==========================================

const outputPath = "/tmp/chart-test.html";
fs.writeFileSync(outputPath, html, "utf-8");

console.log(`\n✅ Chart generated successfully!`);
console.log(`   Output: ${outputPath}`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);

console.log("\n📊 Next steps:");
console.log("   1. Open in browser:");
console.log(`      open ${outputPath}`);
console.log("      firefox ${outputPath}");
console.log("\n   2. Check:");
console.log("      ✅ Controls (checkboxes) display");
console.log("      ✅ Metrics table at bottom");
console.log("      ✅ CSS styles work");
console.log("      ❌ Chart WILL NOT render (Plotly traces TODO)");
console.log("\n   3. After verifying structure:");
console.log("      → Implement Plotly traces generation (chart-html.ts)");
console.log("      → Re-run this script");
console.log("      → See working chart! 🎉");
