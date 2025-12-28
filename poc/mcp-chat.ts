/**
 * Interactive MCP chat — сохраняет сессию между вызовами.
 *
 * Usage:
 *   npx tsx poc/mcp-chat.ts "Привет"
 *   npx tsx poc/mcp-chat.ts --locale en "Hello"
 *   npx tsx poc/mcp-chat.ts --session alice "Привет"
 *   npx tsx poc/mcp-chat.ts --reset
 *   npx tsx poc/mcp-chat.ts --status
 *
 * Batch mode:
 *   npx tsx poc/mcp-chat.ts --batch tests/e2e/batches/search-adhoc.yaml
 *
 * Session хранится в /tmp/mcp-chat-session-{name}.json
 */

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { parse as parseYaml } from "yaml";

import { McpClient } from "../src/telegram-bot/services/mcp-client.js";

// === Types ===

type Locale = "ru" | "en";

type Session = {
  sessionId: string;
  userId: string;
};

type BatchStep = {
  message: string;
  expect?: Record<string, unknown>;
};

type BatchConfig = {
  name: string;
  description?: string;
  locale?: Locale;
  telegramId?: number;
  steps: BatchStep[];
};

type ParsedArgs = {
  sessionName: string;
  command: string | null;
  message: string | null;
  telegramId: number | null;
  locale: Locale;
  batchFile: string | null;
};

// === Constants ===

const MCP_URL = process.env.FACADE_MCP_URL ?? "http://localhost:3001/mcp";

// === Args Parsing ===

function parseArgs(args: string[]): ParsedArgs {
  let sessionName = "default";
  let command: string | null = null;
  let telegramId: number | null = null;
  let locale: Locale = "ru";
  let batchFile: string | null = null;
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
    } else if (args[i] === "--batch" && args[i + 1]) {
      batchFile = args[i + 1];
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
    batchFile,
  };
}

// === Session Management ===

function getSessionFile(sessionName: string): string {
  return `/tmp/mcp-chat-session-${sessionName}.json`;
}

async function loadOrCreateSession(
  client: McpClient,
  sessionName: string,
  telegramId?: number | null,
  silent = false,
): Promise<Session> {
  const sessionFile = getSessionFile(sessionName);

  if (fs.existsSync(sessionFile)) {
    const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    if (!silent) console.log(`📂 Loaded session [${sessionName}]: ${data.sessionId.slice(0, 20)}...`);
    return data;
  }

  if (!silent) console.log(`🆕 Creating new session [${sessionName}]...`);
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
  if (!silent) console.log(`✅ Session created [${sessionName}]: ${session.sessionId.slice(0, 20)}...`);

  return session;
}

function resetSession(sessionName: string, silent = false): void {
  const sessionFile = getSessionFile(sessionName);
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
    if (!silent) console.log(`🗑️  Session [${sessionName}] reset`);
  } else if (!silent) {
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

// === Single Message Chat ===

async function chat(message: string, sessionName: string, telegramId: number | null, locale: Locale): Promise<void> {
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

    if (response.message) {
      console.log(response.message);
    }

    if (response.result.chartUrl) {
      console.log(`\n📈 Chart: ${response.result.chartUrl}`);
    }

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

// === Batch Mode ===

function loadBatch(filePath: string): BatchConfig {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseYaml(content) as BatchConfig;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

type AssertionResult = { passed: boolean; message: string };

function checkAssertions(response: Record<string, unknown>, expect: Record<string, unknown>): AssertionResult[] {
  const results: AssertionResult[] = [];

  for (const [path, expectedValue] of Object.entries(expect)) {
    const actualValue = path === "phase" ? response.result.phase : getNestedValue(response.result, path);

    const passed = JSON.stringify(actualValue) === JSON.stringify(expectedValue);
    results.push({
      passed,
      message: `${path}: ${JSON.stringify(actualValue)} ${passed ? "✅" : `❌ (expected: ${JSON.stringify(expectedValue)})`}`,
    });
  }

  return results;
}

async function runBatch(filePath: string): Promise<void> {
  const batch = loadBatch(filePath);
  const sessionName = `batch-${batch.name}`;
  const locale = batch.locale ?? "ru";
  const startTime = Date.now();

  console.log(`\n📂 Batch: ${batch.name} (locale: ${locale})`);
  if (batch.description) console.log(`   ${batch.description}`);
  console.log("─".repeat(50));

  // Always reset session for batch
  resetSession(sessionName, true);

  const client = await McpClient.create(MCP_URL);
  let totalAssertions = 0;
  let passedAssertions = 0;

  try {
    const session = await loadOrCreateSession(client, sessionName, batch.telegramId, true);

    for (let i = 0; i < batch.steps.length; i++) {
      const step = batch.steps[i];
      console.log(`\n[${i + 1}/${batch.steps.length}] → ${step.message}`);

      const response = await client.callTool("converse", {
        message: step.message,
        sessionId: session.sessionId,
        requestId: randomUUID(),
        locale,
      });

      console.log(`      ← phase: ${response.result.phase}`);

      if (step.expect) {
        const results = checkAssertions(response, step.expect);
        for (const result of results) {
          console.log(`      ← ${result.message}`);
          totalAssertions++;
          if (result.passed) passedAssertions++;
        }
      }

      if (response.result.chartUrl) {
        console.log(`      📈 ${response.result.chartUrl}`);
      }
    }
  } finally {
    await client.close();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "─".repeat(50));

  if (totalAssertions === 0) {
    console.log(`✅ Completed (${duration}s) — no assertions`);
  } else if (passedAssertions === totalAssertions) {
    console.log(`✅ ${passedAssertions}/${totalAssertions} assertions passed (${duration}s)`);
  } else {
    console.log(`❌ ${passedAssertions}/${totalAssertions} assertions passed (${duration}s)`);
    process.exitCode = 1;
  }
}

// === Main ===

function showUsage(): void {
  console.log(`Usage:
  npx tsx poc/mcp-chat.ts "message"                   — send message (default session, ru)
  npx tsx poc/mcp-chat.ts --locale en "message"       — send message (English locale)
  npx tsx poc/mcp-chat.ts --session alice "message"   — send message (named session)
  npx tsx poc/mcp-chat.ts --reset                     — reset default session
  npx tsx poc/mcp-chat.ts --status                    — show session info

Batch mode:
  npx tsx poc/mcp-chat.ts --batch path/to/batch.yaml  — run batch test`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showUsage();
    return;
  }

  const { sessionName, command, message, telegramId, locale, batchFile } = parseArgs(args);

  // Batch mode
  if (batchFile) {
    await runBatch(batchFile);
    return;
  }

  // Commands
  if (command === "reset") {
    resetSession(sessionName);
    return;
  }

  if (command === "status") {
    showStatus(sessionName);
    return;
  }

  // Single message
  if (!message) {
    console.log("Error: No message provided");
    return;
  }

  await chat(message, sessionName, telegramId, locale);
}

main().catch(console.error);
