import { join } from "path";
import { ContextField, SearchConstraints } from "./schemas-zod.js";

export const REQUIRED_FIELDS_FOR_CURRENT_CONTEXT: ContextField[] = [
  "position",
  "domains",
  "skills",
];

export const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

export const DEFAULT_CONSTRAINTS: SearchConstraints = {
  max_timing_diff_months: 12,
  timing_diff_threshold_percent: 50,
  max_experience_diff_months: 120,
  results_limit: 20,
};
// Add other config constants here as needed
// export const DATABASE_URL = process.env.NEO4J_URI || "bolt://localhost:7687";
// export const DATABASE_USER = process.env.NEO4J_USER || "neo4j";
// export const DATABASE_PASSWORD = process.env.NEO4J_PASSWORD || "password";
