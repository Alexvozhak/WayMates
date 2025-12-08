import { ChatOpenAI } from "@langchain/openai";

import type { LlmConfig } from "../types.js";

export class SearchPresenter {
  private llm: ChatOpenAI;

  constructor(apiKey: string, llmConfig: LlmConfig) {
    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
    });
  }

  async formatSearchResult(rawJsonResult: string, languageCode: string): Promise<string> {
    const prompt = this.createPrompt(rawJsonResult, languageCode);
    const response = await this.llm.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : String(response.content);
    return content.trim();
  }

  private createPrompt(rawJson: string, languageCode: string): string {
    const language = this.mapLanguageCode(languageCode);
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
- IMPORTANT: Respond in ${language}

Data (JSON):
${rawJson}

Response (Markdown only, no explanations):`;
  }

  private mapLanguageCode(code: string): string {
    const languageMap: Record<string, string> = {
      ru: "Russian",
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
    };

    return languageMap[code] ?? "Russian";
  }
}
