/**
 * Demo Video 2: Cold Start with PDF CV via Real Telegram
 *
 * Отправляет PDF (Profile.pdf) и точные сообщения из tests/e2e/batches/demo-cold-start.yaml
 * через GramJS в реальный Telegram бот.
 *
 * Env vars needed:
 *   TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
 *   TELEGRAM_BOT_USERNAME (default: @WayMates_bot)
 *
 * Usage:
 *   npx tsx poc/demo-video-2-telegram.ts
 */

import path from "node:path";
import bigInt from "big-integer";
import { Api, sessions, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";

import type { NewMessageEvent } from "telegram/events";

const { StringSession } = sessions;

const BOT = process.env.TELEGRAM_BOT_USERNAME ?? "@WayMates_bot";
const WAIT_MS = 25_000; // 25 sec between messages (cold-start needs more time)
const PDF_PATH = path.resolve(process.cwd(), "Profile.pdf");

// Exact dialog from demo-cold-start.yaml (after CV upload)
const DIALOG_STEPS = [
  // Part 1: Cold-start context confirmation
  { step: 2, message: "Yes, looks good", expectedPhase: "awaiting_context_confirmation" },
  {
    step: 3,
    message: "change domains to backend and mobile, change industry to technology, add skills: qt5, android",
    expectedPhase: "awaiting_context_confirmation",
  },
  { step: 4, message: "Confirmed", expectedPhase: "awaiting_context_confirmation" },
  {
    step: 5,
    message: "change industry to technology, add skills: c++, qt, docker, groovy",
    expectedPhase: "awaiting_context_confirmation",
  },
  { step: 6, message: "Confirmed", expectedPhase: "awaiting_context_confirmation" },
  {
    step: 7,
    message: "change domain devops to backend, add skills: docker, terraform, prometheus, ethers.js",
    expectedPhase: "awaiting_context_confirmation",
  },
  { step: 8, message: "Confirmed", expectedPhase: "awaiting_final_confirmation" },
  { step: 9, message: "Yes, save everything", expectedPhase: "saved" },

  // Part 2: Goal and Pathfinders
  {
    step: 10,
    message: "I want to become head of engineering in Netherlands, AI/ML startup, around 200k salary",
    expectedPhase: "showing_goal",
  },
  { step: 11, message: "Yes, that's my goal", expectedPhase: "asking_search_mode" },
  { step: 12, message: "Show me people who made this transition", expectedPhase: "showing_pathfinder_results" },
  {
    step: 13,
    message: "Which of these candidates matches my trajectory best and why?",
    expectedPhase: "showing_pathfinder_results (advisor)",
  },
  {
    step: 14,
    message: "What key recommendations can you give me based on all found pathfinders?",
    expectedPhase: "showing_pathfinder_results (advisor)",
  },

  // Part 3: Waymates
  { step: 15, message: "Show me waymates", expectedPhase: "showing_waymate_results" },
  { step: 16, message: "What do these candidates have in common?", expectedPhase: "showing_waymate_results (advisor)" },
];

function waitForBotReply(client: TelegramClient, botUsername: string, timeout = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeEventHandler(handler, event);
      reject(new Error(`Timeout (${timeout}ms) waiting for bot reply`));
    }, timeout);

    const event = new NewMessage({ chats: [botUsername] });

    const handler = (e: NewMessageEvent): void => {
      if (e.message.out) return;

      clearTimeout(timer);
      client.removeEventHandler(handler, event);
      resolve(e.message.text ?? "");
    };

    client.addEventHandler(handler, event);
  });
}

async function sendMessage(client: TelegramClient, message: string): Promise<void> {
  await client.invoke(
    new Api.messages.SendMessage({
      peer: BOT,
      message,
      randomId: bigInt(Math.floor(Math.random() * 1e15)),
    }),
  );
}

async function sendPdf(client: TelegramClient, filePath: string): Promise<void> {
  await client.sendFile(BOT, {
    file: filePath,
    forceDocument: true,
  });
}

async function runDemo(client: TelegramClient): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("Demo Video 2: Cold Start with PDF CV");
  console.log("=".repeat(60));

  // Start fresh
  console.log("\n[Step 0] Starting fresh session...");
  const startReply = waitForBotReply(client, BOT, WAIT_MS);
  await sendMessage(client, "/start");
  await startReply;

  // Step 1: Upload PDF
  console.log("\n[Step 1] Uploading PDF CV...");
  console.log(`         File: ${PDF_PATH}`);
  const pdfReply = waitForBotReply(client, BOT, WAIT_MS);
  await sendPdf(client, PDF_PATH);

  console.log(`         Waiting for CV processing...`);
  const response = await pdfReply;
  const preview = response.split("\n").slice(0, 3).join(" ").slice(0, 100);
  console.log(`         Bot: ${preview}...`);

  // Continue with dialog steps
  for (const step of DIALOG_STEPS) {
    console.log(`\n[Step ${step.step}] Sending: "${step.message.slice(0, 50)}..."`);
    console.log(`         Expected: ${step.expectedPhase}`);

    const replyPromise = waitForBotReply(client, BOT, WAIT_MS);
    await sendMessage(client, step.message);

    console.log(`         Waiting for bot reply...`);
    const stepResponse = await replyPromise;
    const stepPreview = stepResponse.split("\n").slice(0, 3).join(" ").slice(0, 100);
    console.log(`         Bot: ${stepPreview}...`);

    // Check for chart URL
    if (stepResponse.includes("r2.dev")) {
      const match = stepResponse.match(/https:\/\/[^\s]+\.html/);
      if (match) {
        console.log(`         📊 Chart: ${match[0]}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Demo Video 2 Complete! (16 steps)");
  console.log("=".repeat(60));
}

async function main(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !session) {
    console.error("Missing: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION");
    console.error("\nTo get session string, run: npx tsx poc/telegram-auth.ts");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, { connectionRetries: 5 });

  await client.connect();
  console.log(`🚀 Connected to Telegram as user`);
  console.log(`🤖 Bot: ${BOT}\n`);

  await runDemo(client);

  await client.disconnect();
}

main().catch(console.error);
