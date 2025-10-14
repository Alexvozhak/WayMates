import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { StoryInput, StoryInputSchema } from "../../src/schemas-zod.js";

function validate<T>(
  data: unknown,
  schema: { parse: (d: unknown) => T },
  name: string
): T {
  try {
    return schema.parse(data);
  } catch (e) {
    throw new Error(`Invalid test data for ${name}: ${e}`);
  }
}

const TRAILS_DIR = join(process.cwd(), "data", "trails", "generated_migrated");

// New directory containing curated user fixtures for fast tests
const USERS_DIR = join(process.cwd(), "data", "trails", "users");
const GOLD_LABELS_PATH = join(
  process.cwd(),
  "data",
  "gold",
  "gold_labels.json"
);

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

  // Prefer curated users directory; fallback to original generated_migrated
  const possiblePaths = [join(USERS_DIR, fileName), join(TRAILS_DIR, fileName)];

  const filePath = possiblePaths.find((p) => {
    try {
      readFileSync(p, "utf-8");
      return true;
    } catch {
      return false;
    }
  });

  if (!filePath) {
    throw new Error(`Test data file not found for key ${userKey}`);
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return validate(raw, StoryInputSchema, `story ${userKey}`);
}

export function loadAllTestData(): StoryInput[] {
  const files = readdirSync(TRAILS_DIR)
    .filter((file) => file.startsWith("trails_") && file.endsWith(".json"))
    .sort();
  return files.map((file) => loadTestData(file));
}

/**
 * Convenience: load multiple users by keys from curated fixtures.
 */
export function loadUsers(keys: string[]): StoryInput[] {
  return keys.map((k) => loadTestData(k));
}

export type GoldLabelEntry = {
  gold_ids: string[];
  justifications: string[];
};

export function loadGoldLabels(): Record<string, GoldLabelEntry> {
  const raw = JSON.parse(readFileSync(GOLD_LABELS_PATH, "utf-8"));
  return raw as Record<string, GoldLabelEntry>;
}
