import type { LangGraphPresenter } from "./presenters/langgraph-presenter.js";
import type { SearchGraphPresenter } from "./presenters/search-graph-presenter.js";
import type { WelcomePresenter } from "./presenters/welcome-presenter.js";
import type { McpClient } from "./services/mcp-client.js";
import type { SessionService } from "./services/session-service.js";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { Context, SessionFlavor } from "grammy";

export type LlmConfig = {
  model: string;
  temperature: number;
};

export type BotServices = {
  mcpClient: McpClient;
  sessionService: SessionService;
  searchGraphPresenter: SearchGraphPresenter;
  langGraphPresenter: LangGraphPresenter;
  welcomePresenter: WelcomePresenter;
  openaiApiKey: string;
  openaiApiBase: string | undefined;
  groqApiKey: string;
  botToken: string;
  feedbackChatId: string | undefined;
};

export type MySessionData = { status: "uninitialised" } | { status: "initialised"; token: string | null };

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services: BotServices;
  };
