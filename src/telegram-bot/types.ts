import type { SessionId, UserId } from "../shared/schemas.js";
import type { SystemMessagePresenter } from "./presenters/system-message-presenter.js";
import type { WelcomePresenter } from "./presenters/welcome-presenter.js";
import type { McpClient } from "./services/mcp-client.js";
import type { SessionService } from "./services/session-service.js";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { Context, SessionFlavor } from "grammy";
import type { Logger } from "pino";

export type LlmConfig = {
  model: string;
  temperature: number;
};

export type BotServices = {
  mcpClient: McpClient;
  sessionService: SessionService;
  systemMessagePresenter: SystemMessagePresenter;
  welcomePresenter: WelcomePresenter;
  openaiApiKey: string;
  openaiApiBase: string | undefined;
  groqApiKey: string;
  botToken: string;
  feedbackChatId: string | undefined;
  logger: Logger;
};

export type MySessionData =
  | { status: "uninitialised" }
  | { status: "initialised"; token: string | null; userId: UserId; sessionId: SessionId };

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services: BotServices;
    requestId: string;
  };
