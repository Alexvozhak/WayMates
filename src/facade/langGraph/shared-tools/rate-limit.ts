import { ChatOpenAI } from "@langchain/openai";
import Bottleneck from "bottleneck";

import { config } from "../../env.js";

import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { ChatOpenAICallOptions } from "@langchain/openai";

/**
 * Bottleneck for OpenAI API quota protection (shared across all LangGraph agents).
 * - reservoir: Token bucket enforces RPM ceiling (refills every 60s)
 * - minTime: Spreads requests evenly (60000ms / RPM) to prevent bursts
 * - maxConcurrent: Caps parallel LLM calls (10 for agents)
 */
const bottleneck = new Bottleneck({
  reservoir: config.OPENAI_FACADE_RPM_LIMIT,
  reservoirRefreshAmount: config.OPENAI_FACADE_RPM_LIMIT,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: config.OPENAI_FACADE_MAX_CONCURRENT,
  minTime: Math.ceil(60_000 / config.OPENAI_FACADE_RPM_LIMIT),
});

bottleneck.on("failed", (error, jobInfo) => {
  console.error("Facade rate limit job failed:", error, jobInfo);
});

bottleneck.on("retry", (message, jobInfo) => {
  console.log("Facade rate limit retry:", message, jobInfo);
});

export class RateLimitedChatOpenAI extends ChatOpenAI {
  override async invoke(input: BaseLanguageModelInput, options?: ChatOpenAICallOptions): Promise<AIMessageChunk> {
    return bottleneck.schedule(() => super.invoke(input, options));
  }
}
