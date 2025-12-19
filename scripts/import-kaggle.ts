#!/usr/bin/env tsx
/* eslint-disable */
// @ts-nocheck

import { readFileSync } from "node:fs";
import { v7 as uuidv7 } from "uuid";
import { withDriver } from "../src/core/neo4j.js";
import { DatabaseContext } from "../src/core/database-context.js";
import { StoryManager } from "../src/core/story-manager.js";
import type { StoryInput, UserContext } from "../src/shared/schemas.js";

// ==========================================
// === TYPE DEFINITIONS ===
// ==========================================

type EnrichedContext = {
  position: string;
  role: string;
  domains: string[];
  skills: string[];
  industry: string | null;
  companySize: string | null;
  countryCode: string | null;
  cityName: string | null;
  citizenships: string[];
  createdAt: string;
  creationReason: string[];
};

type EnrichedPerson = {
  personId: string;
  contexts: EnrichedContext[];
};

// ==========================================
// === HELPER FUNCTIONS ===
// ==========================================

/**
 * Convert enriched context to UserContext with IDs and linked list structure
 */
function buildUserContexts(enrichedContexts: EnrichedContext[]): UserContext[] {
  const contexts: UserContext[] = [];

  for (let i = 0; i < enrichedContexts.length; i++) {
    const enriched = enrichedContexts[i];
    const contextId = `ctx_${uuidv7()}`;

    const userContext: UserContext = {
      contextId,
      previousContextId: i > 0 ? contexts[i - 1].contextId : null,
      nextContextId: null, // Will be set for previous context
      createdAt: enriched.createdAt,
      creationReason: enriched.creationReason as ("started_working" | "company_changed" | "location_changed")[],
      position: enriched.position,
      role: enriched.role,
      domains: enriched.domains,
      skills: enriched.skills,
      industry: enriched.industry!,
      companySize: enriched.companySize ?? undefined,
      countryCode: enriched.countryCode!,
      cityName: enriched.cityName!,
      citizenships: enriched.citizenships,
      birthYear: undefined, // Optional for synthetic users
      educationLevel: undefined,
      salaryExact: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
      languages: undefined,
      feedback: undefined,
    };

    // Set nextContextId for previous context
    if (i > 0) {
      contexts[i - 1].nextContextId = contextId;
    }

    contexts.push(userContext);
  }

  return contexts;
}

// ==========================================
// === MAIN IMPORT LOGIC ===
// ==========================================

async function main() {
  console.log("[Import] Starting Kaggle data import to Neo4j...\n");

  // 1. Load enriched data
  console.log("[1/3] Loading enriched data...");
  const enrichedData: EnrichedPerson[] = JSON.parse(readFileSync("data/kaggle-enriched.json", "utf-8"));
  console.log(
    `✓ Loaded ${enrichedData.length} persons with ${enrichedData.reduce((sum, p) => sum + p.contexts.length, 0)} contexts\n`,
  );

  // 2. Import to Neo4j
  console.log("[2/3] Importing to Neo4j...");

  await withDriver(async (driver) => {
    const db = new DatabaseContext(driver);
    const storyManager = new StoryManager(db);

    let imported = 0;

    for (const person of enrichedData) {
      const userId = `usr_${uuidv7()}`;
      const contexts = buildUserContexts(person.contexts);

      const story: StoryInput = {
        userId,
        contexts,
        trails: [], // Kaggle has no trail data
      };

      console.log(
        `  [${imported + 1}/${enrichedData.length}] Importing user ${userId} (Kaggle ID: ${person.personId}, ${contexts.length} contexts)...`,
      );

      try {
        await storyManager.upsertStory(story);
        imported++;
      } catch (error) {
        console.error(`  ✗ Failed to import ${userId}:`, error);
      }
    }

    console.log(`\n✓ Successfully imported ${imported}/${enrichedData.length} persons\n`);
  });

  // 3. Verification query
  console.log("[3/3] Verifying import...");
  console.log("Run the following Cypher queries to verify:\n");
  console.log("  1. Count synthetic users:");
  console.log("     MATCH (u:User:Synthetic) RETURN count(u) as users\n");
  console.log("  2. Count contexts:");
  console.log("     MATCH (u:User:Synthetic)-[:HAS_CONTEXT]->(c:Context) RETURN count(c) as contexts\n");
  console.log("  3. Sample user:");
  console.log("     MATCH (u:User:Synthetic)-[:HAS_CONTEXT]->(c:Context)");
  console.log("     RETURN u.user_id, c.position, c.created_at");
  console.log("     ORDER BY c.created_at LIMIT 10\n");

  console.log("=== IMPORT COMPLETE ===");
}

main().catch(console.error);
