#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "node:fs";

// ==========================================
// === TYPE DEFINITIONS ===
// ==========================================

type EnrichedContext = {
  position: string;
  role: string;
  domains: string[];
  skills: string[];
  industry: string | null;
  companySize: string | null;
  countryCode: string | null;
  cityName: string | null;
  citizenships: string[];
  createdAt: string;
  creationReason: string[];
};

type EnrichedPerson = {
  personId: string;
  contexts: EnrichedContext[];
};

type Grade = "senior" | "middle" | "junior" | null;

// ==========================================
// === GRADE EXTRACTION ===
// ==========================================

function extractGradeFromTitle(jobTitle: string): Grade {
  const lower = jobTitle.toLowerCase();

  // Senior indicators
  if (
    lower.startsWith("sr.") ||
    lower.startsWith("sr ") ||
    lower.includes("senior") ||
    lower.includes(" lead") ||
    lower.includes("principal") ||
    lower.includes("staff")
  ) {
    return "senior";
  }

  // Junior indicators
  if (
    lower.startsWith("jr.") ||
    lower.startsWith("jr ") ||
    lower.includes("junior") ||
    lower.includes("intern") ||
    lower.includes("co-op") ||
    lower.includes("entry") ||
    lower.includes("associate")
  ) {
    return "junior";
  }

  return null; // Unknown
}

// ==========================================
// === TRAJECTORY INTERPOLATION ===
// ==========================================

function interpolateGrades(grades: Grade[]): ("senior" | "middle" | "junior")[] {
  // Find known grades with their indices
  const known: { grade: "senior" | "middle" | "junior"; index: number }[] = [];
  grades.forEach((g, i) => {
    if (g !== null) {
      known.push({ grade: g, index: i });
    }
  });

  // No known grades → all middle (fallback)
  if (known.length === 0) {
    return grades.map(() => "middle");
  }

  // Interpolate each position
  return grades.map((grade, i) => {
    // Already known
    if (grade !== null) return grade;

    // Find nearest known to the left
    const left = known.filter((k) => k.index < i).pop() ?? null;
    // Find nearest known to the right
    const right = known.find((k) => k.index > i) ?? null;

    // Both sides are senior → senior
    if (left?.grade === "senior" && right?.grade === "senior") return "senior";

    // Both sides are junior → junior
    if (left?.grade === "junior" && right?.grade === "junior") return "junior";

    // Junior → Senior transition → middle (career growth)
    if (left?.grade === "junior" && right?.grade === "senior") return "middle";

    // Senior → Junior (rare, demotion?) → middle
    if (left?.grade === "senior" && right?.grade === "junior") return "middle";

    // Only left known (after last known grade)
    if (left && !right) return left.grade;

    // Only right known (before first known grade)
    if (!left && right) {
      // If first known is senior, assume growth: earlier = middle
      if (right.grade === "senior") return "middle";
      // If first known is junior, earlier also junior
      return right.grade;
    }

    // Mixed cases → middle as safe default
    return "middle";
  });
}

// ==========================================
// === CREATION REASONS ===
// ==========================================

type CreationReason =
  | "started_working"
  | "company_changed"
  | "position_changed"
  | "location_changed"
  | "industry_changed"
  | "domain_changed";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function computeCreationReasons(current: EnrichedContext, previous: EnrichedContext | null): CreationReason[] {
  // First context → started_working
  if (!previous) {
    return ["started_working"];
  }

  const reasons: CreationReason[] = [];

  // Position changed (grade)
  if (current.position !== previous.position) {
    reasons.push("position_changed");
  }

  // Location changed (city or country)
  if (current.cityName !== previous.cityName || current.countryCode !== previous.countryCode) {
    reasons.push("location_changed");
  }

  // Industry changed
  if (current.industry !== previous.industry) {
    reasons.push("industry_changed");
  }

  // Domains changed
  if (!arraysEqual(current.domains, previous.domains)) {
    reasons.push("domain_changed");
  }

  // If no specific reasons detected → assume company changed (default)
  if (reasons.length === 0) {
    reasons.push("company_changed");
  }

  return reasons;
}

// ==========================================
// === MAIN NORMALIZATION ===
// ==========================================

function normalizeData(data: EnrichedPerson[]): EnrichedPerson[] {
  let stats = {
    totalPersons: 0,
    totalContexts: 0,
    knownGrades: 0,
    interpolatedGrades: 0,
    fallbackGrades: 0,
    gradeDistribution: { senior: 0, middle: 0, junior: 0 },
    reasonDistribution: {
      started_working: 0,
      company_changed: 0,
      position_changed: 0,
      location_changed: 0,
      industry_changed: 0,
      domain_changed: 0,
    } as Record<CreationReason, number>,
  };

  const normalized = data.map((person) => {
    stats.totalPersons++;

    // Extract grades from job titles
    const extractedGrades = person.contexts.map((ctx) => extractGradeFromTitle(ctx.position));

    // Count known vs unknown
    const knownCount = extractedGrades.filter((g) => g !== null).length;
    stats.knownGrades += knownCount;

    // Interpolate unknown grades
    const interpolatedGrades = interpolateGrades(extractedGrades);

    // Track stats
    if (knownCount === 0) {
      stats.fallbackGrades += person.contexts.length;
    } else {
      stats.interpolatedGrades += person.contexts.length - knownCount;
    }

    // Apply normalized grades, lowercase skills, and compute reasons
    const normalizedContexts = person.contexts.map((ctx, i) => {
      const newGrade = interpolatedGrades[i] ?? "middle";
      stats.gradeDistribution[newGrade]++;
      stats.totalContexts++;

      // Compute creation reasons based on previous context
      const previousCtx = i > 0 ? (person.contexts[i - 1] ?? null) : null;
      const reasons = computeCreationReasons(ctx, previousCtx);

      // Track reason stats
      for (const reason of reasons) {
        stats.reasonDistribution[reason]++;
      }

      return {
        ...ctx,
        position: newGrade,
        skills: ctx.skills.map((s) => s.toLowerCase()),
        creationReason: reasons,
      };
    });

    return {
      ...person,
      contexts: normalizedContexts,
    };
  });

  // Print stats
  console.log("\n=== Normalization Stats ===\n");
  console.log(`Total persons: ${stats.totalPersons}`);
  console.log(`Total contexts: ${stats.totalContexts}`);
  console.log(`\nGrade sources:`);
  console.log(
    `  Known from title: ${stats.knownGrades} (${((stats.knownGrades / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Interpolated:     ${stats.interpolatedGrades} (${((stats.interpolatedGrades / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Fallback (middle): ${stats.fallbackGrades} (${((stats.fallbackGrades / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(`\nGrade distribution:`);
  console.log(
    `  senior: ${stats.gradeDistribution.senior} (${((stats.gradeDistribution.senior / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  middle: ${stats.gradeDistribution.middle} (${((stats.gradeDistribution.middle / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  junior: ${stats.gradeDistribution.junior} (${((stats.gradeDistribution.junior / stats.totalContexts) * 100).toFixed(1)}%)`,
  );
  console.log(`\nCreation reasons (can overlap):`);
  console.log(`  started_working:  ${stats.reasonDistribution.started_working}`);
  console.log(`  company_changed:  ${stats.reasonDistribution.company_changed}`);
  console.log(`  position_changed: ${stats.reasonDistribution.position_changed}`);
  console.log(`  location_changed: ${stats.reasonDistribution.location_changed}`);
  console.log(`  industry_changed: ${stats.reasonDistribution.industry_changed}`);
  console.log(`  domain_changed:   ${stats.reasonDistribution.domain_changed}`);

  return normalized;
}

// ==========================================
// === MAIN ===
// ==========================================

function main() {
  const inputPath = "data/kaggle-enriched.json";
  const outputPath = "data/kaggle-enriched.json"; // Overwrite

  console.log(`[1/3] Loading ${inputPath}...`);
  const data: EnrichedPerson[] = JSON.parse(readFileSync(inputPath, "utf-8"));
  console.log(`✓ Loaded ${data.length} persons`);

  console.log(`\n[2/3] Normalizing data...`);
  const normalized = normalizeData(data);

  console.log(`\n[3/3] Saving to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
  console.log(`✓ Saved ${normalized.length} persons`);

  console.log("\n=== DONE ===");
}

main();
