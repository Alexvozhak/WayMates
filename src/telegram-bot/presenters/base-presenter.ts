import { ChatOpenAI } from "@langchain/openai";
import Bottleneck from "bottleneck";

import type { LlmConfig } from "../types.js";

/**
 * Base presenter with common LLM formatting logic.
 * Uses Template Method pattern - subclasses only define prompts.
 * Includes Bottleneck rate limiting for LLM calls.
 */
export abstract class BasePresenter {
  protected llm: ChatOpenAI;
  protected limiter: Bottleneck;

  constructor(apiKey: string, llmConfig: LlmConfig, rpmLimit: number, maxConcurrent: number, baseUrl?: string) {
    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
      ...(baseUrl && { configuration: { baseURL: baseUrl } }),
    });

    /**
     * Bottleneck rate limiter for Presenter LLM calls.
     * - reservoir: Token bucket enforces RPM ceiling (refills every 60s)
     * - minTime: Spreads requests evenly (60000ms / RPM)
     * - maxConcurrent: Caps parallel calls (configurable via env)
     */
    this.limiter = new Bottleneck({
      reservoir: rpmLimit,
      reservoirRefreshAmount: rpmLimit,
      reservoirRefreshInterval: 60_000,
      maxConcurrent,
      minTime: Math.ceil(60_000 / rpmLimit),
    });

    this.limiter.on("failed", (error, jobInfo) => {
      console.error("Presenter rate limit job failed:", error, jobInfo);
    });

    this.limiter.on("retry", (message, jobInfo) => {
      console.log("Presenter rate limit retry:", message, jobInfo);
    });
  }

  async format(rawData: unknown, languageCode?: string): Promise<string> {
    const rawJson = JSON.stringify(rawData);
    const language = this.mapLanguageCode(languageCode ?? "en");
    const prompt = this.createPrompt(rawJson, language);

    // Rate-limited LLM call via Bottleneck
    const response = await this.limiter.schedule(() => this.llm.invoke(prompt));

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
