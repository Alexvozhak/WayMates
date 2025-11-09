#!/usr/bin/env tsx

import { readFile, writeFile } from "fs/promises";
import { v7 as uuidv7 } from "uuid";
import path from "path";

/**
 * Migration script: ULID → UUID v7 + snake_case → camelCase
 *
 * Converts test data files from old format to new:
 * 1. ULID IDs → UUID v7 format
 * 2. snake_case properties → camelCase
 * 3. Remove deprecated fields (work_type, team_size)
 * 4. Adjust dates for AC6 recency filter testing
 *
 * Usage:
 *   npm run migrate:test-data u1  # Migrate single file
 *   npm run migrate:test-data all # Migrate all U1-U9
 */

interface LegacyContext {
  context_id: string;
  created_at: string;
  creation_reason: string[];
  previous_context_id?: string | null;
  next_context_id?: string | null;
  position: string;
  domains: string[];
  skills: string[];
  industry: string;
  company_size: string;
  country_code: string;
  city_name: string;
  citizenships: string[];
  birth_year: number;
  work_type?: string; // deprecated
  team_size?: number; // deprecated
}

interface LegacyTrail {
  trail_id?: string;
  skill: string;
  platform: string;
  from_context_id: string;
  to_context_id: string | null;
  total_duration_weeks: number;
  schedule: {
    sessions_per_week: number;
    hours_per_session: number;
  };
  cost_usd: number;
  rating_course: number;
  rating_platform: number;
  rating_schedule: number;
  course_name?: string;
  course_link?: string;
  user_feedback?: string;
}

interface LegacyStoryInput {
  user_id: string;
  contexts: LegacyContext[];
  trails: LegacyTrail[];
}

interface ModernContext {
  contextId: string;
  createdAt: string;
  creationReason: string[];
  previousContextId?: string | null;
  nextContextId?: string | null;
  position: string;
  domains: string[];
  skills: string[];
  industry: string;
  companySize: string;
  countryCode: string;
  cityName: string;
  citizenships: string[];
  birthYear: number;
}

interface ModernTrail {
  skill: string;
  platform: string;
  fromContextId: string;
  toContextId: string | null;
  totalDurationWeeks: number;
  schedule: {
    sessionsPerWeek: number;
    hoursPerSession: number;
  };
  costUsd: number;
  ratingCourse: number;
  ratingPlatform: number;
  ratingSchedule: number;
  courseName?: string;
  courseLink?: string;
  userFeedback?: string;
}

interface ModernStoryInput {
  userId: string;
  contexts: ModernContext[];
  trails: ModernTrail[];
}

type IdMapping = Map<string, string>;

/**
 * Generate UUID v7 with prefix
 */
function generateId(prefix: "usr" | "ctx" | "trl"): string {
  return `${prefix}_${uuidv7()}`;
}

/**
 * Adjust dates for recency filter testing (AC6)
 * U1, U2: Recent (NOW - 2 months)
 * U3, U4: Old (NOW - 18 months)
 */
function adjustDateForRecencyTest(
  userFileName: string,
  contextIndex: number,
  originalDate: string
): string {
  const now = new Date();

  // U1, U2 - recent users
  if (userFileName === "u1" || userFileName === "u2") {
    const recentDate = new Date(now);
    recentDate.setMonth(now.getMonth() - 2 + contextIndex * 12); // First context: -2mo, second: +10mo
    return recentDate.toISOString();
  }

  // U3, U4 - old users
  if (userFileName === "u3" || userFileName === "u4") {
    const oldDate = new Date(now);
    oldDate.setMonth(now.getMonth() - 18 + contextIndex * 12); // First context: -18mo, second: -6mo
    return oldDate.toISOString();
  }

  // Other users - keep original
  return originalDate;
}

/**
 * Convert legacy context to modern format with camelCase
 */
function migrateContext(
  legacy: LegacyContext,
  contextIdMap: IdMapping,
  userFileName: string,
  contextIndex: number
): ModernContext {
  // Generate new UUID v7 or reuse if already mapped
  const newContextId = contextIdMap.get(legacy.context_id) || generateId("ctx");
  contextIdMap.set(legacy.context_id, newContextId);

  const modern: ModernContext = {
    contextId: newContextId,
    createdAt: adjustDateForRecencyTest(userFileName, contextIndex, legacy.created_at),
    creationReason: legacy.creation_reason,
    position: legacy.position,
    domains: legacy.domains,
    skills: legacy.skills,
    industry: legacy.industry,
    companySize: legacy.company_size,
    countryCode: legacy.country_code,
    cityName: legacy.city_name,
    citizenships: legacy.citizenships,
    birthYear: legacy.birth_year,
  };

  // Map previousContextId if exists
  if (legacy.previous_context_id) {
    const prevId = contextIdMap.get(legacy.previous_context_id) || generateId("ctx");
    contextIdMap.set(legacy.previous_context_id, prevId);
    modern.previousContextId = prevId;
  }

  // Map nextContextId if exists
  if (legacy.next_context_id) {
    const nextId = contextIdMap.get(legacy.next_context_id) || generateId("ctx");
    contextIdMap.set(legacy.next_context_id, nextId);
    modern.nextContextId = nextId;
  }

  return modern;
}

/**
 * Convert legacy trail to modern format with camelCase
 */
function migrateTrail(
  legacy: LegacyTrail,
  contextIdMap: IdMapping
): ModernTrail {
  const modern: ModernTrail = {
    skill: legacy.skill,
    platform: legacy.platform,
    fromContextId: contextIdMap.get(legacy.from_context_id)!,
    toContextId: legacy.to_context_id ? contextIdMap.get(legacy.to_context_id)! : null,
    totalDurationWeeks: legacy.total_duration_weeks,
    schedule: {
      sessionsPerWeek: legacy.schedule.sessions_per_week,
      hoursPerSession: legacy.schedule.hours_per_session,
    },
    costUsd: legacy.cost_usd,
    ratingCourse: legacy.rating_course,
    ratingPlatform: legacy.rating_platform,
    ratingSchedule: legacy.rating_schedule,
  };

  // Optional fields
  if (legacy.course_name) modern.courseName = legacy.course_name;
  if (legacy.course_link) modern.courseLink = legacy.course_link;
  if (legacy.user_feedback) modern.userFeedback = legacy.user_feedback;

  return modern;
}

/**
 * Migrate entire story from legacy to modern format
 */
function migrateStory(
  legacy: LegacyStoryInput,
  userFileName: string
): ModernStoryInput {
  const contextIdMap: IdMapping = new Map();
  const userIdMap: IdMapping = new Map();

  // Generate new user ID
  const newUserId = generateId("usr");
  userIdMap.set(legacy.user_id, newUserId);

  // Migrate contexts first (to build ID mapping)
  const modernContexts = legacy.contexts.map((ctx, idx) =>
    migrateContext(ctx, contextIdMap, userFileName, idx)
  );

  // Migrate trails using the context ID mapping
  const modernTrails = legacy.trails.map((trail) =>
    migrateTrail(trail, contextIdMap)
  );

  return {
    userId: newUserId,
    contexts: modernContexts,
    trails: modernTrails,
  };
}

/**
 * Main migration function
 */
async function migrateFile(userFileName: string): Promise<void> {
  const inputPath = path.join(
    process.cwd(),
    "data/trails/users",
    `${userFileName}.json`
  );
  const outputPath = inputPath; // Overwrite original

  console.log(`Migrating ${userFileName}.json...`);

  // Read legacy data
  const rawData = await readFile(inputPath, "utf-8");
  const legacy: LegacyStoryInput = JSON.parse(rawData);

  // Migrate to modern format
  const modern = migrateStory(legacy, userFileName);

  // Write modern data
  await writeFile(outputPath, JSON.stringify(modern, null, 2) + "\n", "utf-8");

  console.log(`✅ Migrated ${userFileName}.json`);
  console.log(`  - User ID: ${legacy.user_id} → ${modern.userId}`);
  console.log(`  - Contexts: ${modern.contexts.length}`);
  console.log(`  - Trails: ${modern.trails.length}`);
}

/**
 * CLI entry point
 */
async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: npm run migrate:test-data <u1|u2|...|u9|all>");
    process.exit(1);
  }

  if (arg === "all") {
    for (let i = 1; i <= 9; i++) {
      await migrateFile(`u${i}`);
    }
    console.log("\n✅ All files migrated successfully!");
  } else if (arg.match(/^u[1-9]$/)) {
    await migrateFile(arg);
  } else {
    console.error(`Invalid argument: ${arg}`);
    console.error("Usage: npm run migrate:test-data <u1|u2|...|u9|all>");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
