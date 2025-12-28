/**
 * Interactive MCP chat — сохраняет сессию между вызовами.
 *
 * Usage:
 *   npx tsx poc/mcp-chat.ts "Привет"
 *   npx tsx poc/mcp-chat.ts "Я backend разработчик"
 *   npx tsx poc/mcp-chat.ts --locale en "Hello"        # English locale
 *   npx tsx poc/mcp-chat.ts --locale ru "Привет"       # Russian locale (default)
 *   npx tsx poc/mcp-chat.ts --reset                    # сбросить сессию
 *   npx tsx poc/mcp-chat.ts --session alice "Привет"   # именованная сессия
 *   npx tsx poc/mcp-chat.ts --session alice --reset    # сбросить именованную
 *   npx tsx poc/mcp-chat.ts --session alice --status   # статус именованной
 *
 * Session хранится в /tmp/mcp-chat-session-{name}.json
 */

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { McpClient } from "../src/telegram-bot/services/mcp-client.js";

function parseArgs(args: string[]): {
  sessionName: string;
  command: string | null;
  message: string | null;
  telegramId: number | null;
  locale: "ru" | "en";
} {
  let sessionName = "default";
  let command: string | null = null;
  let telegramId: number | null = null;
  let locale: "ru" | "en" = "ru";
  const messageWords: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--session" && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    } else if (args[i] === "--telegramId" && args[i + 1]) {
      telegramId = Number(args[i + 1]);
      i++;
    } else if (args[i] === "--locale" && args[i + 1]) {
      locale = args[i + 1] === "en" ? "en" : "ru";
      i++;
    } else if (args[i] === "--reset") {
      command = "reset";
    } else if (args[i] === "--status") {
      command = "status";
    } else {
      messageWords.push(args[i]);
    }
  }

  return {
    sessionName,
    command,
    message: messageWords.length > 0 ? messageWords.join(" ") : null,
    telegramId,
    locale,
  };
}

const MCP_URL = process.env.FACADE_MCP_URL ?? "http://localhost:3001/mcp";

type Session = {
  sessionId: string;
  userId: string;
};

function getSessionFile(sessionName: string): string {
  return `/tmp/mcp-chat-session-${sessionName}.json`;
}

async function loadOrCreateSession(
  client: McpClient,
  sessionName: string,
  telegramId?: number | null,
): Promise<Session> {
  const sessionFile = getSessionFile(sessionName);

  // Try to load existing session
  if (fs.existsSync(sessionFile)) {
    const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    console.log(`📂 Loaded session [${sessionName}]: ${data.sessionId.slice(0, 20)}...`);
    return data;
  }

  // Create new session via register_telegram
  console.log(`🆕 Creating new session [${sessionName}]...`);
  const telegramUserId = telegramId ?? Date.now();

  const authResult = await client.callTool("register_telegram", {
    telegramUserId,
    requestId: randomUUID(),
  });

  const session: Session = {
    sessionId: authResult.sessionId,
    userId: authResult.userId,
  };

  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  console.log(`✅ Session created [${sessionName}]: ${session.sessionId.slice(0, 20)}...`);

  return session;
}

async function chat(
  message: string,
  sessionName: string,
  telegramId: number | null,
  locale: "ru" | "en",
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`→ USER [${sessionName}] (locale: ${locale}): ${message}`);
  console.log("=".repeat(60));

  const client = await McpClient.create(MCP_URL);

  try {
    const session = await loadOrCreateSession(client, sessionName, telegramId);

    const response = await client.callTool("converse", {
      message,
      sessionId: session.sessionId,
      requestId: randomUUID(),
      locale,
    });

    console.log(`\n← BOT (phase: ${response.result.phase}):`);
    console.log("-".repeat(40));

    // Pretty print the response
    if (response.message) {
      console.log(response.message);
    }

    // Show chart URL if available
    if (response.result.chartUrl) {
      console.log(`\n📈 Chart: ${response.result.chartUrl}`);
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

function reset(sessionName: string): void {
  const sessionFile = getSessionFile(sessionName);
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
    console.log(`🗑️  Session [${sessionName}] reset`);
  } else {
    console.log(`ℹ️  No session [${sessionName}] to reset`);
  }
}

function showStatus(sessionName: string): void {
  const sessionFile = getSessionFile(sessionName);
  if (fs.existsSync(sessionFile)) {
    const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    console.log(`Session [${sessionName}]:`, data);
  } else {
    console.log(`No active session [${sessionName}]`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage:
  npx tsx poc/mcp-chat.ts "message"                   — send message (default session, ru)
  npx tsx poc/mcp-chat.ts --locale en "message"       — send message (English locale)
  npx tsx poc/mcp-chat.ts --locale ru "message"       — send message (Russian locale, default)
  npx tsx poc/mcp-chat.ts --session alice "message"   — send message (named session)
  npx tsx poc/mcp-chat.ts --reset                     — reset default session
  npx tsx poc/mcp-chat.ts --session alice --reset     — reset named session
  npx tsx poc/mcp-chat.ts --status                    — show default session info
  npx tsx poc/mcp-chat.ts --session alice --status    — show named session info`);
    return;
  }

  const { sessionName, command, message, telegramId, locale } = parseArgs(args);

  if (command === "reset") {
    reset(sessionName);
    return;
  }

  if (command === "status") {
    showStatus(sessionName);
    return;
  }

  if (!message) {
    console.log("Error: No message provided");
    return;
  }

  await chat(message, sessionName, telegramId, locale);
}

main().catch(console.error);
