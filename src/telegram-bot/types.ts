import type { GoalPresenter } from "./presenters/goal-presenter.js";
import type { LangGraphPresenter } from "./presenters/langgraph-presenter.js";
import type { SearchGraphPresenter } from "./presenters/search-graph-presenter.js";
import type { SearchPresenter } from "./presenters/search-presenter.js";
import type { StoryPresenter } from "./presenters/story-presenter.js";
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
  // DEPRECATED: Remove in Phase 4 after handlers migration
  searchPresenter: SearchPresenter;
  storyPresenter: StoryPresenter;
  goalPresenter: GoalPresenter;
};

export type PendingAction =
  | "story"
  | "by_target"
  | "by_adhoc"
  | "by_current"
  | "set_goal"
  | "update_context"
  | "add_context"
  | "add_trail"
  | "feedback";

export type MySessionData =
  | { status: "uninitialised" }
  | {
      status: "initialised";
      token: string | null;
      pendingAction?: PendingAction;
    };

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services: BotServices;
  };
