import type { SystemMessagePresenter } from "./presenters/system-message-presenter.js";
import type { McpClient } from "./services/mcp-client.js";
import type { MessageBatcherService } from "./services/message-batcher.service.js";
import type { SessionService } from "./services/session-service.js";
import type { ConverseResponse, SessionId, UserId } from "../../private/schemas.js";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { Context } from "grammy";
import type { Logger } from "pino";

export type LlmConfig = {
  model: string;
  temperature: number;
};

export type BotServices = {
  mcpClient: McpClient;
  sessionService: SessionService;
  messageBatcher: MessageBatcherService<ConverseResponse>;
  systemMessagePresenter: SystemMessagePresenter;
  openaiApiKey: string;
  openaiApiBase: string | undefined;
  groqApiKey: string;
  botToken: string;
  feedbackChatId: string | undefined;
  logger: Logger;
};

export type UserInfo = {
  userId: UserId;
  sessionId: SessionId;
  token: string | null;
};

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> & {
    services: BotServices;
    requestId: string;
    userInfo?: UserInfo;
  };
