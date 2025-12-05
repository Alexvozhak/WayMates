import type { Context } from "grammy";
import type OpenAI from "openai";

export type LlmConfig = {
  model: string;
  temperature: number;
};

export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  openaiClient: OpenAI;
  botToken: string;
  formatterLlm: LlmConfig;
};

export type SessionData = {
  sessionId: string;
  hasStory: boolean;
  token: string;
};

export type SessionStorage = Map<number, SessionData>;

export type PendingAction = "story" | "search";

export type PendingActionStorage = Map<number, PendingAction>;

export type BotContext = Context & {
  services: BotServices;
  sessions: SessionStorage;
  pendingActions: PendingActionStorage;
};
