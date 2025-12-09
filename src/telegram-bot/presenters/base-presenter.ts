import { ChatOpenAI } from "@langchain/openai";

import type { LlmConfig } from "../types.js";

/**
 * Base presenter with common LLM formatting logic.
 * Uses Template Method pattern - subclasses only define prompts.
 */
export abstract class BasePresenter {
  protected llm: ChatOpenAI;

  constructor(apiKey: string, llmConfig: LlmConfig) {
    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
    });
  }

  async format(rawData: unknown, languageCode?: string): Promise<string> {
    const rawJson = JSON.stringify(rawData);
    const language = this.mapLanguageCode(languageCode ?? "en");
    const prompt = this.createPrompt(rawJson, language);
    const response = await this.llm.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : String(response.content);
    return content.trim();
  }

  /**
   * Subclasses must implement prompt creation logic.
   */
  protected abstract createPrompt(rawJson: string, language: string): string;

  protected mapLanguageCode(code: string): string {
    const languageMap: Record<string, string> = {
      ru: "Russian",
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
    };

    return languageMap[code] ?? "English";
  }
}
