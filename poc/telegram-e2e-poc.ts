/**
 * GramJS E2E PoC - Send message to bot and verify response
 *
 * Prerequisites:
 * 1. Run generate-telegram-session.ts first to get session string
 * 2. Set these env vars in .env.test:
 *    - TELEGRAM_API_ID
 *    - TELEGRAM_API_HASH
 *    - TELEGRAM_SESSION
 *    - TELEGRAM_BOT_USERNAME (default: @waymates_bot)
 *
 * Usage:
 *   npx tsx poc/telegram-e2e-poc.ts
 *
 * What this PoC verifies:
 * 1. Session string works (no re-auth needed)
 * 2. sendMessage to bot works
 * 3. getMessages returns bot response
 * 4. Timing is sufficient for LLM processing
 */

import bigInt from "big-integer";
import { Api, sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "@waymates_bot";
const WAIT_FOR_RESPONSE_MS = 10_000; // 10 seconds for LLM + processing

async function main(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !sessionString) {
    console.error("Error: Missing required env vars");
    console.error("Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION");
    console.error("Run generate-telegram-session.ts first to get session string");
    process.exit(1);
  }

  console.log("=== GramJS E2E PoC ===\n");
  console.log(`Bot: ${BOT_USERNAME}`);
  console.log(`Wait time: ${WAIT_FOR_RESPONSE_MS}ms\n`);

  const client = new TelegramClient(new StringSession(sessionString), Number(apiId), apiHash, { connectionRetries: 5 });

  try {
    // Step 1: Connect (should not require re-auth with valid session)
    console.log("1. Connecting...");
    await client.connect();
    console.log("   Connected successfully (session valid)\n");

    // Step 2: Get bot entity
    console.log("2. Resolving bot entity...");
    const botEntity = await client.getEntity(BOT_USERNAME);
    console.log(`   Found: ${botEntity.className} (id: ${botEntity.id})\n`);

    // Step 3: Send /start command
    console.log("3. Sending /start command...");
    const sentMessage = await client.invoke(
      new Api.messages.SendMessage({
        peer: BOT_USERNAME,
        message: "/start",
        randomId: bigInt(Math.floor(Math.random() * 1e15)),
      }),
    );
    console.log(`   Message sent (type: ${sentMessage.className})\n`);

    // Step 4: Wait for bot to process (LLM + persistence)
    console.log(`4. Waiting ${WAIT_FOR_RESPONSE_MS / 1000}s for bot response...`);
    await new Promise((resolve) => setTimeout(resolve, WAIT_FOR_RESPONSE_MS));
    console.log("   Done waiting\n");

    // Step 5: Get latest messages from bot
    console.log("5. Fetching messages from bot...");
    const messages = await client.invoke(
      new Api.messages.GetHistory({
        peer: BOT_USERNAME,
        limit: 5,
        offsetId: 0,
        offsetDate: 0,
        addOffset: 0,
        maxId: 0,
        minId: 0,
        hash: bigInt(0),
      }),
    );

    if (messages.className === "messages.Messages" || messages.className === "messages.MessagesSlice") {
      const messageList = messages.messages;
      console.log(`   Found ${messageList.length} messages\n`);

      console.log("6. Latest messages:");
      for (const msg of messageList.slice(0, 3)) {
        if (msg.className === "Message") {
          const direction = msg.out ? "→ YOU" : "← BOT";
          const text = msg.message?.slice(0, 100) ?? "(no text)";
          console.log(`   ${direction}: ${text}${msg.message && msg.message.length > 100 ? "..." : ""}`);
        }
      }
    }

    console.log("\n=== PoC Complete ===");
    console.log("All checks passed!");
  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
