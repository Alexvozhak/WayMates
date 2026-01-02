/**
 * Setup Goals for Waymate demo fixtures (0005-0008)
 *
 * Waymates are people with same goal but haven't reached it yet.
 * Goal: head of engineering in NL, AI startup
 *
 * Usage: set -a && source .env.test && set +a && npx tsx scripts/setup-waymate-goals.ts
 */

import { createDriver } from "../src/core/neo4j.js";

const WAYMATE_USER_IDS = [
  "usr_019b0055-0005-7000-8000-000000000001", // IdealWaymate
  "usr_019b0055-0006-7000-8000-000000000001", // SprintWaymate
  "usr_019b0055-0007-7000-8000-000000000001", // AltWaymate
  "usr_019b0055-0008-7000-8000-000000000001", // DirectWaymate
];

const GOAL_TARGET_CONTEXT = JSON.stringify({
  position: { mode: "desired", values: ["head of engineering"] },
  role: { mode: "desired", values: ["manager"] },
  countries: { mode: "desired", values: ["NL"] },
  domains: { mode: "desired", values: ["ai"] },
  skills: null,
  languages: null,
  industries: null,
  cities: null,
  citizenships: null,
  educationLevels: null,
});

async function main(): Promise<void> {
  const driver = createDriver();
  const session = driver.session();

  try {
    for (const userId of WAYMATE_USER_IDS) {
      const result = await session.run(
        `
        MATCH (u:User {userId: $userId})
        MERGE (u)-[:HAS_GOAL]->(g:Goal)
        SET g.targetContext = $targetContext,
            g.createdAt = datetime(),
            g.updatedAt = datetime()
        RETURN u.userId AS userId
        `,
        { userId, targetContext: GOAL_TARGET_CONTEXT },
      );

      if (result.records.length > 0) {
        console.log(`✅ Goal set for ${userId}`);
      } else {
        console.log(`❌ User not found: ${userId}`);
      }
    }

    console.log(`\n✅ Goals set for ${WAYMATE_USER_IDS.length} waymates`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(console.error);
