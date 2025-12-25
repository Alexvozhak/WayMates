/**
 * Interactive MCP chat — сохраняет сессию между вызовами.
 *
 * Usage:
 *   npx tsx poc/mcp-chat.ts "Привет"
 *   npx tsx poc/mcp-chat.ts "Я backend разработчик"
 *   npx tsx poc/mcp-chat.ts --reset  # сбросить сессию
 *
 * Session хранится в /tmp/mcp-chat-session.json
 */

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { McpClient } from "../src/telegram-bot/services/mcp-client.js";

const SESSION_FILE = "/tmp/mcp-chat-session.json";
const MCP_URL = process.env.FACADE_MCP_URL ?? "http://localhost:3001/mcp";

type Session = {
  sessionId: string;
  userId: string;
};

async function loadOrCreateSession(client: McpClient): Promise<Session> {
  // Try to load existing session
  if (fs.existsSync(SESSION_FILE)) {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    console.log(`📂 Loaded session: ${data.sessionId.slice(0, 20)}...`);
    return data;
  }

  // Create new session via register_telegram
  console.log("🆕 Creating new session...");
  const telegramUserId = Date.now(); // number, not string

  const authResult = await client.callTool("register_telegram", {
    telegramUserId,
    requestId: randomUUID(),
  });

  const session: Session = {
    sessionId: authResult.sessionId,
    userId: authResult.userId,
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(`✅ Session created: ${session.sessionId.slice(0, 20)}...`);

  return session;
}

async function chat(message: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`→ USER: ${message}`);
  console.log("=".repeat(60));

  const client = await McpClient.create(MCP_URL);

  try {
    const session = await loadOrCreateSession(client);

    const response = await client.callTool("converse", {
      message,
      sessionId: session.sessionId,
      requestId: randomUUID(),
    });

    console.log(`\n← BOT (phase: ${response.result.phase}):`);
    console.log("-".repeat(40));

    // Pretty print the response
    if (response.message) {
      console.log(response.message);
    }

    // Show structured data for debugging
    console.log("\n📊 Structured data:");
    const { phase, ...rest } = response.result;
    if (Object.keys(rest).length > 0) {
      console.log(JSON.stringify(rest, null, 2).slice(0, 500));
      if (JSON.stringify(rest).length > 500) console.log("... (truncated)");
    }

    console.log("\n" + "=".repeat(60));
  } finally {
    await client.close();
  }
}

async function reset(): Promise<void> {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
    console.log("🗑️  Session reset");
  } else {
    console.log("ℹ️  No session to reset");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage:
  npx tsx poc/mcp-chat.ts "message"   — send message
  npx tsx poc/mcp-chat.ts --reset     — reset session
  npx tsx poc/mcp-chat.ts --status    — show session info`);
    return;
  }

  if (args[0] === "--reset") {
    await reset();
    return;
  }

  if (args[0] === "--status") {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      console.log("Session:", data);
    } else {
      console.log("No active session");
    }
    return;
  }

  await chat(args.join(" "));
}

main().catch(console.error);
