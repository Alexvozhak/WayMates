import { ChatOpenAI } from "@langchain/openai";

import { extractTextContent } from "../services/mcp-utils.js";

import type { McpToolResult } from "../services/mcp-client.js";
import type { LlmConfig } from "../types.js";

export type FormatSearchParams = {
  apiKey: string;
  llmConfig: LlmConfig;
  languageCode: string;
  result: McpToolResult;
};

export async function formatSearchResult(params: FormatSearchParams): Promise<string> {
  const { apiKey, llmConfig, languageCode, result } = params;

  const text = extractTextContent(result);
  if (!text) {
    throw new Error("Failed to extract search results");
  }

  const llm = new ChatOpenAI({
    modelName: llmConfig.model,
    temperature: llmConfig.temperature,
    openAIApiKey: apiKey,
  });

  const prompt = createPrompt(text, languageCode);
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content : String(response.content);

  return content.trim();
}

function createPrompt(rawJson: string, languageCode: string): string {
  return `You are a friendly career consultant in a Telegram bot.

Task: Present career path search results in a warm, human tone.

Rules:
- Use emojis sparingly (📊 🎯 💼 🔧 📍)
- Format with Markdown (bold **text**, lists)
- Each path should be a separate block
- Highlight similarity percentage and key skills
- Add a short intro (1-2 sentences)
- Avoid template phrases like "Here's what I found"
- Show top 5 results maximum
- If no results, say it naturally
- IMPORTANT: Respond in ${mapLanguageCode(languageCode)}

Data (JSON):
${rawJson}

Response (Markdown only, no explanations):`;
}

function mapLanguageCode(code: string): string {
  const languageMap: Record<string, string> = {
    ru: "Russian",
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
  };

  return languageMap[code] ?? "Russian";
}
