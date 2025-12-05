import { z } from "zod";

import { McpClientError } from "../errors.js";

import type { BotContext, SessionData } from "../types.js";

let requestId = 0;

const mcpResponseSchema = z.object({
  result: z
    .object({
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        }),
      ),
      isError: z.boolean().optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

const sessionResponseSchema = z.object({
  sessionId: z.string(),
  token: z.string(),
  hasStory: z.boolean(),
});

export type McpToolResult = {
  content: {
    type: string;
    text?: string | undefined;
  }[];
  isError?: boolean | undefined;
};

export async function callTool(
  ctx: BotContext,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    throw new McpClientError("Cannot call tool: Telegram user ID not found");
  }

  let session = ctx.sessions.get(telegramUserId);

  if (!session) {
    session = await refreshSession(ctx, telegramUserId);
  }

  const paramsWithSession = { ...params, sessionId: session.sessionId };

  await ctx.replyWithChatAction("typing");

  try {
    const result = await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, toolName, paramsWithSession);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("session_expired")) {
      session = await refreshSession(ctx, telegramUserId);
      const retryParams = { ...params, sessionId: session.sessionId };
      return await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, toolName, retryParams);
    }

    const cause = error instanceof Error ? error : undefined;
    throw new McpClientError(`Failed to call tool ${toolName}`, cause);
  }
}

export async function ensureSession(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    throw new McpClientError("Cannot ensure session: Telegram user ID not found");
  }

  if (ctx.sessions.has(telegramUserId)) {
    return;
  }

  await refreshSession(ctx, telegramUserId);
}

async function refreshSession(ctx: BotContext, telegramUserId: number): Promise<SessionData> {
  const result = await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, "register_telegram", {
    telegramUserId,
    telegramUsername: ctx.from?.username,
    telegramFirstName: ctx.from?.first_name,
  });

  const content = validateToolContent(result);
  const jsonData = parseToolContentAsJson(content.text);
  const parsed = sessionResponseSchema.parse(jsonData);
  const sessionData: SessionData = {
    sessionId: parsed.sessionId,
    hasStory: parsed.hasStory,
    token: parsed.token,
  };

  ctx.sessions.set(telegramUserId, sessionData);

  return sessionData;
}

const MAX_RETRIES = 3;

async function sendMcpRequestWithRetry(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await attemptMcpRequest(facadeUrl, toolName, params);
    if (result.success) {
      return result.value;
    }

    lastError = result.error;
    if (isClientError(lastError)) {
      throw lastError;
    }

    const delay = Math.pow(2, attempt) * 1000;
    await sleep(delay);
  }

  throw new McpClientError(`Failed after ${MAX_RETRIES} retries`, lastError);
}

type AttemptResult = { success: true; value: McpToolResult } | { success: false; error: Error };

async function attemptMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<AttemptResult> {
  try {
    const value = await sendMcpRequest(facadeUrl, toolName, params);
    return { success: true, value };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err };
  }
}

function isClientError(error: Error): boolean {
  return error.message.includes("HTTP error 4");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  const response = await fetch(facadeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    }),
  });

  if (!response.ok) {
    throw new McpClientError(`HTTP error ${response.status}: ${response.statusText}`);
  }

  const jsonData: unknown = await response.json();
  const data = mcpResponseSchema.parse(jsonData);

  if (data.error) {
    throw new McpClientError(`MCP error: ${data.error.message}`);
  }

  if (!data.result) {
    throw new McpClientError("No result in MCP response");
  }

  return data.result;
}

function validateToolContent(result: McpToolResult): { type: string; text: string } {
  if (result.content.length === 0) {
    throw new McpClientError("Tool result has no content");
  }

  const firstContent = result.content[0];
  if (!firstContent || firstContent.type !== "text") {
    throw new McpClientError(`Unexpected content type: ${firstContent?.type}`);
  }

  if (!firstContent.text) {
    throw new McpClientError("Content has no text");
  }

  return { type: firstContent.type, text: firstContent.text };
}

function parseToolContentAsJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new McpClientError("Failed to parse tool result as JSON");
  }
}
