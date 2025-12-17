#!/usr/bin/env tsx
// @ts-nocheck

import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { storyInputSchema } from "../src/shared/schemas.js";

import type { StoryInput } from "../src/shared/schemas.js";

const TEST_DATA_DIR = "data/trails/users";
const USER_FILE_PATTERN = /^u\d+\.json$/;

/**
 * Validates test data files (data/trails/users/*.json) against StoryInputSchema
 *
 * Checks:
 * - UUID v7 format for all IDs
 * - camelCase property names
 * - Valid ISO 8601 dates
 * - Required fields present
 *
 * Usage:
 *   npm run validate:test-data       # All files (auto-discovered)
 *   npm run validate:test-data u1    # Single file
 */
async function main(): Promise<void> {
  const arg = process.argv[2] || "all";
  const fileNames = arg === "all" ? getAllTestFiles() : [arg];

  console.log(`\nValidating ${fileNames.length} files...`);

  const results = await Promise.all(fileNames.map((fileName) => validateSingleFile(fileName)));

  const valid = results.filter((r) => r === "valid").length;
  const invalid = results.filter((r) => r === "invalid").length;

  console.log(
    `\n${valid === fileNames.length ? "✅" : "❌"} ${valid}/${fileNames.length} files valid\n`,
  );

  if (invalid > 0) {
    process.exit(1);
  }
}

await main();

function checkEmptyFieldsInContexts(contexts: StoryInput["contexts"]): string[] {
  return contexts.flatMap((ctx, idx) => {
    const warnings: string[] = [];
    if (ctx.skills.length === 0) {
      warnings.push(`Context ${idx} has empty skills array`);
    }
    if (ctx.domains.length === 0) {
      warnings.push(`Context ${idx} has empty domains array`);
    }
    return warnings;
  });
}

function checkTrailReferences(
  trails: StoryInput["trails"],
  validContextIds: Set<string>,
): string[] {
  return trails.flatMap((trail, idx) => {
    const warnings: string[] = [];
    if (trail.fromContextId && !validContextIds.has(trail.fromContextId)) {
      warnings.push(`Trail ${idx}: fromContextId references non-existent context`);
    }
    if (trail.toContextId && !validContextIds.has(trail.toContextId)) {
      warnings.push(`Trail ${idx}: toContextId references non-existent context`);
    }
    return warnings;
  });
}

function checkWarnings(data: StoryInput): string[] {
  const contextIds = new Set(data.contexts.map((c) => c.contextId));
  const contextWarnings = checkEmptyFieldsInContexts(data.contexts);
  const trailWarnings = checkTrailReferences(data.trails, contextIds);
  return [...contextWarnings, ...trailWarnings];
}

async function validateFile(fileName: string): Promise<void> {
  const filePath = path.join(process.cwd(), TEST_DATA_DIR, `${fileName}.json`);
  const rawData = await readFile(filePath, "utf8");
  const jsonData = JSON.parse(rawData);

  const data = storyInputSchema.parse(jsonData);
  const warnings = checkWarnings(data);

  console.log(`✅ ${fileName}.json`);
  console.log(`    - User ID: ${data.userId}`);
  console.log(`    - Contexts: ${data.contexts.length}`);
  console.log(`    - Trails: ${data.trails.length}`);

  if (warnings.length > 0) {
    console.log(`    ⚠️  Warnings:`);
    warnings.forEach((w) => console.log(`      - ${w}`));
  }
}

function getAllTestFiles(): string[] {
  return readdirSync(TEST_DATA_DIR)
    .filter((file) => USER_FILE_PATTERN.test(file))
    .map((file) => file.replace(".json", ""));
}

async function validateSingleFile(fileName: string): Promise<"valid" | "invalid"> {
  try {
    await validateFile(fileName);
    return "valid";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${fileName}.json: ${message}`);
    return "invalid";
  }
}
