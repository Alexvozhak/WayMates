import { join } from "path";
import { ContextField } from "./core/schemas.js";
import type { SearchConstraints } from "./core/schemas.js";

export const REQUIRED_FIELDS_FOR_CURRENT_CONTEXT: ContextField[] = [
  "position",
  "domains",
  "skills",
];

export const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

export const DEFAULT_CONSTRAINTS: SearchConstraints = {
  maxTimingDiffMonths: 12,
  timingDiffThresholdPercent: 50,
  maxExperienceDiffMonths: 120,
  resultsLimit: 20,
  requiredSkills: [],
};
// Add other config constants here as needed
// export const DATABASE_URL = process.env.NEO4J_URI || "bolt://localhost:7687";
// export const DATABASE_USER = process.env.NEO4J_USER || "neo4j";
// export const DATABASE_PASSWORD = process.env.NEO4J_PASSWORD || "password";
