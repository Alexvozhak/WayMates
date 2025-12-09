import type { ColdStartPresenter } from "./presenters/cold-start-presenter.js";
import type { SearchPresenter } from "./presenters/search-presenter.js";
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
  searchPresenter: SearchPresenter;
  coldStartPresenter: ColdStartPresenter;
  welcomePresenter: WelcomePresenter;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
};

export type PendingAction = "story" | "by_target" | "by_adhoc" | "by_current";

export type MySessionData =
  | { status: "uninitialised" }
  | {
      status: "initialised";
      token: string;
      hasStory: boolean;
      pendingAction?: PendingAction;
    };

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services: BotServices;
  };
