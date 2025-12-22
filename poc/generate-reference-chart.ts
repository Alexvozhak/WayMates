/**
 * Generate reference chart with all features demonstrated.
 */

import * as fs from "node:fs";
import { ChartBuilder } from "../src/chart/builders/chart-builder.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";
import { userTrajectory, candidates, goalValues } from "./chart-reference-fixtures.js";

console.log("📊 Generating reference chart...\n");

console.log("User trajectory:", userTrajectory.length, "contexts");
console.log("Candidates:", candidates.length);
console.log("  - Pathfinders:", candidates.filter((c) => c.candidateType === "pathfinder").length);
console.log("  - Waymates:", candidates.filter((c) => c.candidateType === "waymate").length);
console.log("Goal values:", goalValues);
console.log();

const builder = new ChartBuilder({
  userTrajectory,
  candidates,
  fields: DEFAULT_FIELDS,
  locale: "ru",
  existingGoal: true,
  goalValues,
});

const html = builder.build();

const outputPath = "poc/chart-reference.html";
fs.writeFileSync(outputPath, html);

console.log(`✅ Chart generated: ${outputPath}`);
console.log(`   Size: ${(html.length / 1024).toFixed(2)} KB`);
console.log();
console.log("🔗 Open in browser:");
console.log(`   firefox ${outputPath}`);
