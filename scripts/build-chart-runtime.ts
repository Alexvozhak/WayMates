/**
 * Build chart browser runtime using esbuild.
 * Compiles src/chart/browser/chart-runtime.ts → dist/chart/browser/chart-runtime.js
 */

import { buildSync } from "esbuild";
import { mkdirSync } from "node:fs";

const OUT_DIR = "dist/chart/browser";
const ENTRY = "src/chart/browser/chart-runtime.ts";
const OUT_FILE = `${OUT_DIR}/chart-runtime.js`;

mkdirSync(OUT_DIR, { recursive: true });

const result = buildSync({
  entryPoints: [ENTRY],
  outfile: OUT_FILE,
  bundle: true,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "ChartRuntime",
});

if (result.errors.length > 0) {
  console.error("❌ Build failed:", result.errors);
  process.exit(1);
}

console.log(`✅ Chart runtime compiled to ${OUT_FILE}`);
