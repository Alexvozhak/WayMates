/**
 * GramJS Session Generator for PRODUCTION Telegram
 *
 * Use this if you want to test with real Telegram (not Test DC).
 * Code will come to your regular Telegram app.
 *
 * Usage:
 *   export TELEGRAM_API_ID=... TELEGRAM_API_HASH=...
 *   npx tsx poc/generate-telegram-session-prod.ts
 */

import * as readline from "readline";

import { sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

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
    process.exit(1);
  }

  console.log("=== Telegram PRODUCTION Session Generator ===\n");
  console.log("Code will come to your regular Telegram app.\n");

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await ask("Enter your phone number (e.g. +79281186515): "),
    password: async () => await ask("Enter 2FA password (if any): "),
    phoneCode: async () => await ask("Enter the code from Telegram: "),
    onError: (err) => console.error("Error:", err),
  });

  console.log("\n=== Authentication successful! ===\n");
  console.log("Add this to your .env.test file:\n");
  console.log(`TELEGRAM_SESSION=${client.session.save()}`);
  console.log("");

  await client.disconnect();
  rl.close();
}

main().catch(console.error);
