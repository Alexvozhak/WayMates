#!/usr/bin/env tsx

import { readFile } from "fs/promises";
import path from "path";
import { StoryInputSchema } from "../src/shared/schemas.js";
import type { StoryInput } from "../src/shared/schemas.js";

/**
 * Validation script for migrated test data
 *
 * Validates test data files against StoryInputSchema (Zod)
 * Ensures:
 * 1. UUID v7 format for all IDs
 * 2. camelCase property names
 * 3. No deprecated fields (work_type, team_size)
 * 4. Valid ISO 8601 dates
 * 5. All required fields present
 *
 * Usage:
 *   npm run validate:test-data u1  # Validate single file
 *   npm run validate:test-data all # Validate all U1-U9
 */

interface ValidationResult {
  fileName: string;
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  data?: StoryInput;
}

/**
 * Validate single file against StoryInputSchema
 */
async function validateFile(userFileName: string): Promise<ValidationResult> {
  const filePath = path.join(process.cwd(), "data/trails/users", `${userFileName}.json`);

  try {
    // Read file
    const rawData = await readFile(filePath, "utf-8");
    const jsonData = JSON.parse(rawData);

    // Validate against Zod schema
    const result = StoryInputSchema.safeParse(jsonData);

    if (result.success) {
      return {
        fileName: userFileName,
        valid: true,
        data: result.data,
        warnings: checkWarnings(result.data),
      };
    } else {
      const errors = result.error.errors.map((err) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });

      return {
        fileName: userFileName,
        valid: false,
        errors,
      };
    }
  } catch (error) {
    return {
      fileName: userFileName,
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Check for warnings (non-critical issues)
 */
function checkWarnings(data: StoryInput): string[] {
  const warnings: string[] = [];

  // Check for potential issues
  data.contexts.forEach((ctx, idx) => {
    // Warn if context has no skills
    if (ctx.skills.length === 0) {
      warnings.push(`Context ${idx} has empty skills array`);
    }

    // Warn if context has no domains
    if (ctx.domains.length === 0) {
      warnings.push(`Context ${idx} has empty domains array`);
    }
  });

  // Check trails reference valid contexts
  const contextIds = new Set(data.contexts.map((c) => c.contextId));
  data.trails.forEach((trail, idx) => {
    if (!contextIds.has(trail.fromContextId)) {
      warnings.push(`Trail ${idx}: fromContextId references non-existent context`);
    }
    if (trail.toContextId && !contextIds.has(trail.toContextId)) {
      warnings.push(`Trail ${idx}: toContextId references non-existent context`);
    }
  });

  return warnings;
}

/**
 * Print validation results
 */
function printResults(results: ValidationResult[]): void {
  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  console.log("\n" + "=".repeat(60));
  console.log("VALIDATION RESULTS");
  console.log("=".repeat(60));

  if (valid.length > 0) {
    console.log(`\n✅ Valid files (${valid.length}):`);
    valid.forEach((r) => {
      console.log(`  ${r.fileName}.json`);
      if (r.data) {
        console.log(`    - User ID: ${r.data.userId}`);
        console.log(`    - Contexts: ${r.data.contexts.length}`);
        console.log(`    - Trails: ${r.data.trails.length}`);
      }
      if (r.warnings && r.warnings.length > 0) {
        console.log(`    ⚠️  Warnings:`);
        r.warnings.forEach((w) => console.log(`      - ${w}`));
      }
    });
  }

  if (invalid.length > 0) {
    console.log(`\n❌ Invalid files (${invalid.length}):`);
    invalid.forEach((r) => {
      console.log(`  ${r.fileName}.json`);
      if (r.errors) {
        r.errors.forEach((e) => console.log(`    - ${e}`));
      }
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Summary: ${valid.length}/${results.length} files valid`);
  console.log("=".repeat(60) + "\n");

  // Exit with error code if any invalid
  if (invalid.length > 0) {
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: npm run validate:test-data <u1|u2|...|u9|all>");
    process.exit(1);
  }

  let fileNames: string[];

  if (arg === "all") {
    fileNames = Array.from({ length: 9 }, (_, i) => `u${i + 1}`);
  } else if (arg.match(/^u[1-9]$/)) {
    fileNames = [arg];
  } else {
    console.error(`Invalid argument: ${arg}`);
    console.error("Usage: npm run validate:test-data <u1|u2|...|u9|all>");
    process.exit(1);
  }

  console.log(`Validating ${fileNames.length} file(s)...`);

  const results = await Promise.all(fileNames.map((name) => validateFile(name)));

  printResults(results);
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
