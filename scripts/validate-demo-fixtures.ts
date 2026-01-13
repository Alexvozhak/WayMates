/**
 * Validate demo fixtures against Zod schemas.
 * Run: npx tsx scripts/validate-demo-fixtures.ts
 */

import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { trailSchema, userContextSchema } from "../private/schemas.js";

const FIXTURES_DIR = path.join(import.meta.dirname, "../tests/core/fixtures");
const DEMO_PATTERN = /^Demo-.*\.json$/;

const fixtureSchema = z.object({
  userId: z.string(),
  currentContextId: z.string(),
  contexts: z.array(z.unknown()),
  trails: z.array(z.unknown()),
});

function formatErrors(fileName: string, category: string, index: number, issues: z.ZodIssue[]): string {
  return `${fileName} ${category}[${index}]: ${issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`;
}

function validateFixture(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = fixtureSchema.safeParse(JSON.parse(content));

  if (!parsed.success) {
    errors.push(`Invalid fixture structure: ${parsed.error.message}`);
    return { valid: false, errors };
  }

  const fixture = parsed.data;
  const fileName = path.basename(filePath);

  fixture.contexts.forEach((ctx, i) => {
    const result = userContextSchema.safeParse(ctx);
    if (!result.success) {
      errors.push(formatErrors(fileName, "context", i, result.error.issues));
    }
  });

  fixture.trails.forEach((trail, i) => {
    const result = trailSchema.safeParse(trail);
    if (!result.success) {
      errors.push(formatErrors(fileName, "trail", i, result.error.issues));
    }
  });

  return { valid: errors.length === 0, errors };
}

function printResult(file: string, valid: boolean, errors: string[]): void {
  if (valid) {
    console.log(`✅ ${file}`);
    return;
  }
  console.log(`❌ ${file}`);
  errors.forEach((error) => console.log(`   ${error}`));
}

function main(): void {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => DEMO_PATTERN.test(f));

  console.log(`\nValidating ${files.length} demo fixtures...\n`);

  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(FIXTURES_DIR, file);
    const { valid, errors } = validateFixture(filePath);
    printResult(file, valid, errors);
    totalErrors += errors.length;
  }

  console.log();
  if (totalErrors === 0) {
    console.log("✅ All fixtures valid!");
  } else {
    console.log(`❌ ${totalErrors} errors found`);
    process.exitCode = 1;
  }
}

main();
