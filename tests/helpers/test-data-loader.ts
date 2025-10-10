import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  StoryInput,
  StoryInputSchema,
  validateSchema,
} from "../../src/schemas-zod.js";

const TRAILS_DIR = join(
  process.cwd(),
  "data",
  "trails",
  "generated_migrated"
);
const GOLD_LABELS_PATH = join(process.cwd(), "data", "gold", "gold_labels.json");

function resolveTrailFileName(key: string): string {
  let normalized = key.trim().toLowerCase();
  if (normalized.endsWith(".json")) {
    normalized = normalized.slice(0, -5);
  }
  if (!normalized.startsWith("trails_")) {
    normalized = `trails_${normalized}`;
  }
  return `${normalized}.json`;
}

export function loadTestData(userKey: string): StoryInput {
  const fileName = resolveTrailFileName(userKey);
  const filePath = join(TRAILS_DIR, fileName);
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return validateSchema(raw, StoryInputSchema, `story ${userKey}`);
}

export function loadAllTestData(): StoryInput[] {
  const files = readdirSync(TRAILS_DIR)
    .filter((file) => file.startsWith("trails_") && file.endsWith(".json"))
    .sort();
  return files.map((file) => loadTestData(file));
}

export type GoldLabelEntry = {
  gold_ids: string[];
  justifications: string[];
};

export function loadGoldLabels(): Record<string, GoldLabelEntry> {
  const raw = JSON.parse(readFileSync(GOLD_LABELS_PATH, "utf-8"));
  return raw as Record<string, GoldLabelEntry>;
}
