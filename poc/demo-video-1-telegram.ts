/**
 * Demo Video 1: Adhoc Quick Search via Real Telegram
 *
 * Отправляет точные сообщения из tests/e2e/batches/demo-adhoc.yaml
 * через GramJS в реальный Telegram бот.
 *
 * Env vars needed:
 *   TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
 *   TELEGRAM_BOT_USERNAME (default: @WayMates_bot)
 *
 * Usage:
 *   npx tsx poc/demo-video-1-telegram.ts
 */

import bigInt from "big-integer";
import { Api, sessions, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";

import type { NewMessageEvent } from "telegram/events";

const { StringSession } = sessions;

const BOT = process.env.TELEGRAM_BOT_USERNAME ?? "@WayMates_bot";
const WAIT_MS = 45_000; // 45 sec — exploration/search can take 30+ sec

// Exact dialog from demo-adhoc.yaml
const DIALOG_STEPS = [
  {
    step: 1,
    message:
      "Hey, I'm just browsing. I'm a technical project manager in fintech, managing backend teams, based in Russia",
    expectedPhase: "confirming_adhoc_context",
  },
  {
    step: 2,
    message: "Show me similar people",
    expectedPhase: "showing_exploration_candidates",
  },
  {
    step: 3,
    message: "I want to become head of engineering in Netherlands, AI/ML startup, around 200k salary",
    expectedPhase: "showing_goal",
  },
  {
    step: 4,
    message: "Yes, that's correct",
    expectedPhase: "asking_search_mode",
  },
  {
    step: 5,
    message: "Show me people who made this transition",
    expectedPhase: "showing_pathfinder_results",
  },
  {
    step: 6,
    message: "What skills did they all need for this transition?",
    expectedPhase: "showing_pathfinder_results (with advisor answer)",
  },
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

async function runDemo(client: TelegramClient): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("Demo Video 1: Adhoc Quick Search");
  console.log("=".repeat(60));

  // Start fresh
  console.log("\n[Step 0] Starting fresh session...");
  const startReply = waitForBotReply(client, BOT, WAIT_MS);
  await sendMessage(client, "/start");
  await startReply;

  for (const step of DIALOG_STEPS) {
    console.log(`\n[Step ${step.step}] Sending: "${step.message.slice(0, 60)}..."`);
    console.log(`         Expected: ${step.expectedPhase}`);

    const replyPromise = waitForBotReply(client, BOT, WAIT_MS);
    await sendMessage(client, step.message);

    console.log(`         Waiting for bot reply...`);
    const response = await replyPromise;
    const preview = response.split("\n").slice(0, 3).join(" ").slice(0, 100);
    console.log(`         Bot: ${preview}...`);

    // Check for chart URL
    if (response.includes("r2.dev")) {
      const match = response.match(/https:\/\/[^\s]+\.html/);
      if (match) {
        console.log(`         📊 Chart: ${match[0]}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Demo Video 1 Complete!");
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
