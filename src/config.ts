import { join } from "path";

/**
 * Application configuration constants
 */
export const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

// Add other config constants here as needed
// export const DATABASE_URL = process.env.NEO4J_URI || "bolt://localhost:7687";
// export const DATABASE_USER = process.env.NEO4J_USER || "neo4j";
// export const DATABASE_PASSWORD = process.env.NEO4J_PASSWORD || "password";
