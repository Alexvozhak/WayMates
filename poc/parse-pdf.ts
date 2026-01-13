/**
 * Parse PDF via MCP parse_cv_to_text tool
 * Usage: npx tsx poc/parse-pdf.ts /path/to/file.pdf
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { McpClient } from "../src/telegram-bot/services/mcp-client.js";

const MCP_URL = process.env.FACADE_MCP_URL ?? "http://localhost:3001/mcp";

async function main(): Promise<void> {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx poc/parse-pdf.ts /path/to/file.pdf");
    process.exit(1);
  }

  console.log(`Parsing: ${pdfPath}`);

  const client = await McpClient.create(MCP_URL);

  try {
    // Read PDF and convert to base64
    const pdfBuffer = readFileSync(pdfPath);
    const fileBuffer = pdfBuffer.toString("base64");

    // Register to get sessionId
    const auth = await client.callTool("register_telegram", {
      telegramUserId: Date.now(),
      requestId: randomUUID(),
    });

    // Parse CV
    const result = await client.callTool("parse_cv_to_text", {
      sessionId: auth.sessionId,
      fileBuffer,
      requestId: randomUUID(),
    });

    console.log("\n=== PARSED CV ===\n");
    console.log(result.text);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
