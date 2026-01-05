/**
 * Test PDF upload i18n - sends Profile.pdf to bot
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { sessions, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";

import type { NewMessageEvent } from "telegram/events";

const { StringSession } = sessions;
const BOT = process.env.TELEGRAM_BOT_USERNAME ?? "@WayMates_bot";

async function main(): Promise<void> {
  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION!),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH!,
    { connectionRetries: 5 },
  );

  await client.connect();
  console.log("🚀 Connected to Telegram");

  // Collect bot replies
  const replies: string[] = [];
  const event = new NewMessage({ chats: [BOT] });

  const handler = (e: NewMessageEvent): void => {
    if (!e.message.out) {
      replies.push(e.message.text ?? "");
      console.log(`📩 Reply #${replies.length}: ${(e.message.text ?? "").slice(0, 100)}...`);
    }
  };

  client.addEventHandler(handler, event);

  // Send PDF file
  const pdfPath = path.join(process.cwd(), "Profile.pdf");
  console.log(`\n📤 Sending PDF: ${pdfPath}`);

  await client.sendFile(BOT, {
    file: fs.readFileSync(pdfPath),
    fileName: "Profile.pdf",
  });

  console.log("⏳ Waiting 60 seconds for processing...\n");
  await new Promise((r) => setTimeout(r, 60_000));

  client.removeEventHandler(handler, event);

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Total replies: ${replies.length}`);
  console.log("\n📝 Replies:");
  replies.forEach((r, i) => {
    console.log(`\n--- Reply #${i + 1} ---`);
    console.log(r.slice(0, 300));
  });

  // Check i18n
  const hasProcessing = replies.some((r) => r.includes("Processing") || r.includes("Обрабатываю"));
  console.log(`\n✅ i18n check: ${hasProcessing ? "PASSED" : "NOT FOUND"}`);

  await client.disconnect();
}

main().catch(console.error);
