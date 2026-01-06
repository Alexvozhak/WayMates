#!/usr/bin/env npx tsx
/**
 * Cleanup test user by telegram_user_id
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-user.ts --telegramId 379154408
 *
 * What it does:
 *   1. Finds userId in Postgres by telegram_user_id
 *   2. Calls tRPC story.deleteStory → deletes user + contexts + trails from Neo4j
 *   3. Deletes checkpoints + user from Postgres
 */

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { Redis } from "ioredis";
import pg from "pg";

import type { AppRouter } from "../src/shared/types.js";

const CORE_URL = process.env.CORE_API_URL ?? "http://localhost:3001";
const REDIS_URL = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? 6380}`;
const PG_CONFIG = {
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5433),
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "testpassword123",
  database: process.env.POSTGRES_DB ?? "waymates_facade_test",
};

async function cleanup(telegramUserId: number): Promise<void> {
  console.log(`\n🧹 Cleaning up user (telegram_user_id: ${telegramUserId})...\n`);

  // 1. Find userId in Postgres
  const pgClient = new pg.Client(PG_CONFIG);
  await pgClient.connect();

  const userResult = await pgClient.query<{ user_id: string }>(
    "SELECT user_id FROM facade.users WHERE telegram_user_id = $1",
    [telegramUserId],
  );

  if (userResult.rows.length === 0) {
    console.log("   ⚠️  No user found in Postgres");
    await pgClient.end();

    // Still clear Redis cache in case it's stale
    const redis = new Redis(REDIS_URL);
    const sessionKey = `telegram:session:${telegramUserId}:sessionId`;
    const deleted = await redis.del(sessionKey);
    if (deleted > 0) {
      console.log(`   Redis: cleared stale session cache`);
    }
    await redis.quit();
    return;
  }

  const userId = userResult.rows[0]!.user_id;
  console.log(`   Found user: ${userId}`);

  // 2. Call tRPC to delete from Neo4j (user, contexts, trails)
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({ url: CORE_URL })],
  });

  const neo4jResult = await trpc.story.deleteStory.mutate({ userId });
  console.log(`   Neo4j: deleted ${neo4jResult.deletedContexts} contexts, ${neo4jResult.deletedTrails} trails`);

  // 2.1 Delete Goal from Neo4j (not included in deleteStory)
  const goalResult = await trpc.goal.delete.mutate({ userId });
  console.log(`   Neo4j: deleted goal: ${goalResult.success}`);

  // 3. Delete checkpoints from Postgres
  const checkpointResult = await pgClient.query("DELETE FROM facade.checkpoints WHERE thread_id LIKE $1", [
    `%${userId}%`,
  ]);
  console.log(`   Postgres: deleted ${checkpointResult.rowCount ?? 0} checkpoints`);

  // 4. Delete cold_start_completions
  await pgClient.query("DELETE FROM facade.cold_start_completions WHERE user_id = $1", [userId]);

  // 5. Delete user from Postgres
  await pgClient.query("DELETE FROM facade.users WHERE user_id = $1", [userId]);
  console.log(`   Postgres: deleted user record`);

  await pgClient.end();

  // 6. Clear Redis session cache (prevents "session expired" after /start)
  const redis = new Redis(REDIS_URL);
  const sessionKey = `telegram:session:${telegramUserId}:sessionId`;
  const deleted = await redis.del(sessionKey);
  console.log(`   Redis: cleared session cache (${deleted} keys)`);
  await redis.quit();

  console.log(`\n✅ Cleanup complete for telegram_user_id: ${telegramUserId}\n`);
}

// Parse args
const args = process.argv.slice(2);
const telegramIdIndex = args.indexOf("--telegramId");

if (telegramIdIndex === -1 || !args[telegramIdIndex + 1]) {
  console.error("Usage: npx tsx scripts/cleanup-test-user.ts --telegramId <telegram_user_id>");
  process.exit(1);
}

const telegramUserId = Number(args[telegramIdIndex + 1]);

if (Number.isNaN(telegramUserId)) {
  console.error("Error: telegramId must be a number");
  process.exit(1);
}

await cleanup(telegramUserId);
