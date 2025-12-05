import { McpClientError } from "../errors.js";

import type { McpToolResult } from "./mcp-client.js";

export function extractTextContent(result: McpToolResult): string | null {
  const content = result.content[0];
  if (!content || content.type !== "text" || !content.text) {
    return null;
  }
  return content.text;
}

export function parseJsonContent<T>(result: McpToolResult): T | null {
  const text = extractTextContent(result);
  if (!text) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown, generic T is caller's responsibility
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getTextOrError(result: McpToolResult, errorMessage: string): string {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError(errorMessage);
  }
  return text;
}
