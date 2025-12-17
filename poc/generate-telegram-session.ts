/**
 * GramJS Session Generator for Telegram TEST Environment
 *
 * Uses official Telegram Test DC with test phone numbers.
 * No real phone number required!
 *
 * Test phone numbers (from https://core.telegram.org/api/auth#test-accounts):
 *   +99966XYYYY where X = DC number (1-3), YYYY = X repeated 4 times
 *   Example: +9996621111 → code 11111 (DC 2)
 *   Example: +9996631111 → code 11111 (DC 3)
 *
 * Prerequisites:
 * 1. Get api_id and api_hash from https://my.telegram.org/apps
 * 2. Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env.test
 *
 * Usage:
 *   source .env.test && npx tsx poc/generate-telegram-session.ts
 *
 * After successful login, copy the session string to .env.test:
 *   TELEGRAM_SESSION=1BQANOTEu...
 */

import * as readline from "readline";

import { sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

// Test DC 2 (Amsterdam) — most stable for testing
const TEST_DC_ID = 2;
const TEST_DC_IP = "149.154.167.40";
const TEST_DC_PORT = 443;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    console.error("Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set");
    console.error("Get them from https://my.telegram.org/apps");
    process.exit(1);
  }

  console.log("=== Telegram TEST Environment Session Generator ===\n");
  console.log("This uses Telegram's official test servers.");
  console.log("No real phone number required!\n");
  console.log("Test phone numbers:");
  console.log("  +9996621111 → code: 11111");
  console.log("  +9996622222 → code: 22222");
  console.log("  +9996631111 → code: 11111");
  console.log("");

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
    connectionRetries: 5,
  });

  // Connect to Test DC
  client.session.setDC(TEST_DC_ID, TEST_DC_IP, TEST_DC_PORT);

  await client.connect();
  console.log(`Connected to Test DC ${TEST_DC_ID} (${TEST_DC_IP})\n`);

  await client.start({
    phoneNumber: async () => await ask("Enter test phone number (e.g. +9996621111): "),
    password: async () => await ask("Enter 2FA password (if any, usually empty): "),
    phoneCode: async () => await ask("Enter the code (e.g. 11111): "),
    onError: (err) => console.error("Error:", err),
  });

  console.log("\n=== Authentication successful! ===\n");
  console.log("Add this to your .env.test file:\n");
  console.log(`TELEGRAM_SESSION=${client.session.save()}`);
  console.log("\nNote: This session is for TEST environment only!");
  console.log("");

  await client.disconnect();
  rl.close();
}

main().catch(console.error);
