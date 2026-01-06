/**
 * Interactive Telegram Chat CLI (GramJS)
 *
 * Аналог mcp-chat.ts, но для реального Telegram через GramJS.
 * Claude может отправлять сообщения от твоего лица и видеть ответы бота.
 *
 * Usage:
 *   npx tsx poc/telegram-chat.ts "Hello bot"           # Send message
 *   npx tsx poc/telegram-chat.ts --file Profile.pdf    # Send file
 *   npx tsx poc/telegram-chat.ts --start               # Send /start
 *   npx tsx poc/telegram-chat.ts --wait-double "msg"   # Wait for 2 replies (CV upload)
 *
 * Env vars:
 *   TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
 *   TELEGRAM_BOT_USERNAME (default: @WayMates_bot)
 */

import path from "node:path";
import bigInt from "big-integer";
import { Api, sessions, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";

import type { NewMessageEvent } from "telegram/events";

const { StringSession } = sessions;

const BOT = process.env.TELEGRAM_BOT_USERNAME ?? "@WayMates_bot";
const TIMEOUT_MS = 60_000;

function waitForBotReply(client: TelegramClient, botUsername: string, timeout = TIMEOUT_MS): Promise<string> {
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
      resolve(e.message.text ?? "[no text - possibly media]");
    };

    client.addEventHandler(handler, event);
  });
}

function waitForDoubleReply(
  client: TelegramClient,
  botUsername: string,
  timeout = 90_000,
): Promise<{ first: string; second: string }> {
  return new Promise((resolve, reject) => {
    let firstMsg: string | null = null;

    const timer = setTimeout(() => {
      client.removeEventHandler(handler, event);
      if (firstMsg) {
        resolve({ first: firstMsg, second: "[timeout waiting for second message]" });
      } else {
        reject(new Error(`Timeout (${timeout}ms) waiting for bot replies`));
      }
    }, timeout);

    const event = new NewMessage({ chats: [botUsername] });

    const handler = (e: NewMessageEvent): void => {
      if (e.message.out) return;

      if (!firstMsg) {
        firstMsg = e.message.text ?? "[no text]";
        console.log(`[1st reply]: ${firstMsg.slice(0, 80)}...`);
      } else {
        clearTimeout(timer);
        client.removeEventHandler(handler, event);
        resolve({ first: firstMsg, second: e.message.text ?? "[no text]" });
      }
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

async function sendFile(client: TelegramClient, filePath: string): Promise<void> {
  await client.sendFile(BOT, {
    file: filePath,
    forceDocument: true,
  });
}

async function main(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !session) {
    console.error("Missing: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION");
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log('  npx tsx poc/telegram-chat.ts "message"');
    console.log("  npx tsx poc/telegram-chat.ts --file /path/to/file");
    console.log("  npx tsx poc/telegram-chat.ts --start");
    console.log('  npx tsx poc/telegram-chat.ts --wait-double "message"');
    process.exit(0);
  }

  const client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, { connectionRetries: 5 });

  await client.connect();
  console.log(`Connected to Telegram | Bot: ${BOT}`);
  console.log("─".repeat(60));

  try {
    if (args[0] === "--start") {
      console.log("→ Sending: /start");
      const replyPromise = waitForBotReply(client, BOT);
      await sendMessage(client, "/start");
      const reply = await replyPromise;
      console.log("─".repeat(60));
      console.log("← Bot reply:");
      console.log(reply);
    } else if (args[0] === "--file" && args[1]) {
      const filePath = path.resolve(process.cwd(), args[1]);
      console.log(`→ Sending file: ${filePath}`);
      const replyPromise = waitForDoubleReply(client, BOT);
      await sendFile(client, filePath);
      const { first, second } = await replyPromise;
      console.log("─".repeat(60));
      console.log("← Bot reply (1st - processing):");
      console.log(first);
      console.log("─".repeat(60));
      console.log("← Bot reply (2nd - result):");
      console.log(second);
    } else if (args[0] === "--wait-double" && args[1]) {
      const message = args[1];
      console.log(`→ Sending (wait double): ${message}`);
      const replyPromise = waitForDoubleReply(client, BOT);
      await sendMessage(client, message);
      const { first, second } = await replyPromise;
      console.log("─".repeat(60));
      console.log("← Bot reply (1st):");
      console.log(first);
      console.log("─".repeat(60));
      console.log("← Bot reply (2nd):");
      console.log(second);
    } else {
      const message = args.join(" ");
      console.log(`→ Sending: ${message}`);
      const replyPromise = waitForBotReply(client, BOT);
      await sendMessage(client, message);
      const reply = await replyPromise;
      console.log("─".repeat(60));
      console.log("← Bot reply:");
      console.log(reply);

      // Check for chart URL
      if (reply.includes("r2.dev")) {
        const match = reply.match(/https:\/\/[^\s]+\.html/);
        if (match) {
          console.log("─".repeat(60));
          console.log(`📊 Chart URL: ${match[0]}`);
        }
      }
    }
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
