import { ChatOpenAI } from "@langchain/openai";
import Bottleneck from "bottleneck";

import type { LlmConfig } from "../types.js";
import type { Logger } from "pino";

/**
 * Base presenter with common LLM formatting logic.
 * Uses Template Method pattern - subclasses only define prompts.
 * Includes Bottleneck rate limiting for LLM calls.
 */
export abstract class BasePresenter {
  protected llm: ChatOpenAI;
  protected limiter: Bottleneck;
  protected logger: Logger;

  constructor(
    apiKey: string,
    llmConfig: LlmConfig,
    rpmLimit: number,
    maxConcurrent: number,
    logger: Logger,
    baseUrl?: string,
  ) {
    this.logger = logger;
    const baseConfig = baseUrl ? { configuration: { baseURL: baseUrl } } : {};

    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
      ...baseConfig,
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
      this.logger.error({ err: error, jobInfo }, "Presenter rate limit job failed");
    });

    this.limiter.on("retry", (message, jobInfo) => {
      this.logger.info({ message, jobInfo }, "Presenter rate limit retry");
    });
  }

  async format(rawData: unknown, languageCode?: string): Promise<string> {
    const rawJson = JSON.stringify(rawData);
    const language = this.mapLanguageCode(languageCode);
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

  protected mapLanguageCode(code?: string): string {
    const languageMap: Record<string, string> = {
      ru: "Russian",
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
    };

    return languageMap[code ?? "en"] ?? "English";
  }
}
