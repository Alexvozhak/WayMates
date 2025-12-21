/**
 * Chart Overlap Test - проверка Projection Lines
 *
 * Создаёт данные с РЕАЛЬНЫМ overlap чтобы проверить:
 * - Overlap Timeline показывает периоды
 * - Projection Lines включаются по галочке
 */

import fs from "node:fs";
import { ChartBuilder } from "../src/chart/builders/chart-builder.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";

// ==========================================
// === INLINE DATA WITH OVERLAP ===
// ==========================================

// User: только junior, ЕЩЁ НЕ достиг цели (middle)
const userTrajectory: UserContext[] = [
  {
    contextId: "ctx_user_1",
    position: "Junior Frontend Developer",
    domains: ["frontend"],
    skills: ["JavaScript", "React"],
    industry: "tech",
    companySize: "51-200",
    countryCode: "DE",
    cityName: "berlin",
    citizenships: ["DE"],
    birthYear: 1995,
    createdAt: "2025-01-01T00:00:00Z",
    creationReason: ["started_working"],
  },
];

// Pathfinder: достиг middle РАНЬШЕ User (2025-03-01 vs User 2025-06-01)
// Overlap: junior период 2025-01-01 → 2025-03-01 (когда оба были junior, frontend, berlin, tech)
const candidateContexts: UserContext[] = [
  {
    contextId: "ctx_cand_1",
    position: "Junior Frontend Developer",
    domains: ["frontend"],
    skills: ["JavaScript", "Vue"],
    industry: "tech",
    companySize: "201-500",
    countryCode: "DE",
    cityName: "berlin",
    citizenships: ["DE"],
    birthYear: 1993,
    createdAt: "2024-06-01T00:00:00Z", // Pathfinder начал раньше
    creationReason: ["started_working"],
  },
  {
    contextId: "ctx_cand_2",
    position: "Middle Frontend Developer",
    domains: ["frontend"],
    skills: ["JavaScript", "Vue", "TypeScript"],
    industry: "tech",
    companySize: "201-500",
    countryCode: "DE",
    cityName: "berlin",
    citizenships: ["DE"],
    birthYear: 1993,
    createdAt: "2025-03-01T00:00:00Z", // Pathfinder достиг middle раньше User (2025-06-01)
    creationReason: ["promotion"],
  },
];

const candidates: ScoredMatchedCandidate[] = [
  {
    userId: "usr_overlap_test",
    matchedContext: candidateContexts[1]!,
    timeSinceMatchedMonths: 4,
    contextMatchScore: 90,
    candidateType: "pathfinder",
    path: candidateContexts,
    dtwMetrics: {
      shapeSimilarity: 0.92,
      tempoSimilarity: 0.88,
      stabilityScore: 0.85,
    },
    dtwTotal: 2.65,
  },
];

console.log("✅ Created inline data:");
console.log("   User: junior 2025-01-01 → now (ЕЩЁ НЕ достиг цели)");
console.log("   Pathfinder: junior 2024-06-01 → 2025-03-01, middle 2025-03-01 → now");
console.log("   Goal: middle (User стремится, Pathfinder уже достиг)");
console.log("   Expected overlap: 2025-01-01 → 2025-03-01 (~2 months, когда оба были junior)");
console.log("   Matching aspects: position=junior, domains=frontend, city=berlin, industry=tech");

// ==========================================
// === BUILD CHART ===
// ==========================================

console.log("\n⏳ Building chart...");

const builder = new ChartBuilder({
  userTrajectory,
  candidates,
  fields: DEFAULT_FIELDS,
  locale: "ru",
  existingGoal: true,
  goalValues: { position: "middle", domains: "frontend" },
});

const html = builder.build();

// ==========================================
// === SAVE AND VERIFY ===
// ==========================================

const outputPath = "poc/chart-overlap-test.html";
fs.writeFileSync(outputPath, html, "utf-8");

// Extract overlap data from generated HTML
const overlapMatch = html.match(/"overlapSummaries":\[([^\]]+)\]/);
if (overlapMatch) {
  console.log("\n📊 Overlap data in generated HTML:");
  console.log(`   ${overlapMatch[0].slice(0, 200)}...`);
}

console.log(`\n✅ Chart generated: ${outputPath}`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);
console.log("\n🔗 Открыть в браузере и проверить:");
console.log("   1. Overlap Timeline внизу должен показывать период ~90 дней");
console.log("   2. Галочка 'Show connection lines' должна рисовать вертикальные штрихи");
console.log(`\n   firefox ${outputPath}`);
