import { FastMCP } from "fastmcp";

import { throwToolError } from "../errors.js";

import {
  authParamsSchema,
  coldStartParamsSchema,
  deleteContextParamsSchema,
  deleteGoalParamsSchema,
  deleteTrailParamsSchema,
  facadeAdhocSearchParamsSchema,
  getGoalParamsSchema,
  getStoryParamsSchema,
  resetColdStartParamsSchema,
  searchByTargetParamsSchema,
  searchUserCareersParamsSchema,
  setGoalParamsSchema,
  telegramLinkParamsSchema,
  telegramRegisterParamsSchema,
  updateContextParamsSchema,
  upsertContextParamsSchema,
  upsertTrailParamsSchema,
} from "./schemas.js";
import { AuthTool } from "./tools/auth.tool.js";
import { ColdStartTool } from "./tools/cold-start.tool.js";
import { DeleteContextTool } from "./tools/delete-context.tool.js";
import { DeleteGoalTool } from "./tools/delete-goal.tool.js";
import { DeleteTrailTool } from "./tools/delete-trail.tool.js";
import { GetGoalTool } from "./tools/get-goal.tool.js";
import { GetStoryTool } from "./tools/get-story.tool.js";
import { ResetColdStartTool } from "./tools/reset-cold-start.tool.js";
import { SearchByTargetTool } from "./tools/search-by-target.tool.js";
import { SearchCareersTool } from "./tools/search-careers.tool.js";
import { SearchUserCareersTool } from "./tools/search-user-careers.tool.js";
import { SetGoalTool } from "./tools/set-goal.tool.js";
import { UpdateContextTool } from "./tools/update-context.tool.js";
import { UpsertContextTool } from "./tools/upsert-context.tool.js";
import { UpsertTrailTool } from "./tools/upsert-trail.tool.js";

import type { CoreClient } from "../core-client.js";
import type { AuthService } from "../services/auth.service.js";
import type { CheckpointService } from "../services/checkpoint.service.js";
import type { Normalizer } from "../services/normalizer.js";
import type { SessionService } from "../services/session.service.js";
import type { UserService } from "../services/user.service.js";

export type FacadeServerDependencies = {
  sessionMiddleware: SessionService;
  normalizer: Normalizer;
  coreClient: CoreClient;
  checkpointService: CheckpointService;
  userService: UserService;
  authService: AuthService;
};

type ToolInstances = {
  auth: AuthTool;
  coldStart: ColdStartTool;
  resetColdStart: ResetColdStartTool;
  getStory: GetStoryTool;
  searchCareers: SearchCareersTool;
  searchUserCareers: SearchUserCareersTool;
  setGoal: SetGoalTool;
  updateContext: UpdateContextTool;
  getGoal: GetGoalTool;
  deleteGoal: DeleteGoalTool;
  searchByTarget: SearchByTargetTool;
  deleteContext: DeleteContextTool;
  upsertContext: UpsertContextTool;
  upsertTrail: UpsertTrailTool;
  deleteTrail: DeleteTrailTool;
};

function createToolInstances(deps: FacadeServerDependencies): ToolInstances {
  const toolDeps = {
    session: deps.sessionMiddleware,
    normalizer: deps.normalizer,
    coreClient: deps.coreClient,
    checkpointService: deps.checkpointService,
    userService: deps.userService,
  };

  return {
    auth: new AuthTool(deps.authService),
    coldStart: new ColdStartTool(toolDeps),
    resetColdStart: new ResetColdStartTool(toolDeps),
    getStory: new GetStoryTool(toolDeps),
    searchCareers: new SearchCareersTool(toolDeps),
    searchUserCareers: new SearchUserCareersTool(toolDeps),
    setGoal: new SetGoalTool(toolDeps),
    updateContext: new UpdateContextTool(toolDeps),
    getGoal: new GetGoalTool(toolDeps),
    deleteGoal: new DeleteGoalTool(toolDeps),
    searchByTarget: new SearchByTargetTool(toolDeps),
    deleteContext: new DeleteContextTool(toolDeps),
    upsertContext: new UpsertContextTool(toolDeps),
    upsertTrail: new UpsertTrailTool(toolDeps),
    deleteTrail: new DeleteTrailTool(toolDeps),
  };
}

function registerAuthTool(server: FastMCP, tool: AuthTool): void {
  server.addTool({
    name: "auth",
    description:
      "Authenticate or register user. Without token: creates new user + returns token + sessionId. " +
      "With token: validates token + returns sessionId. Single Active Session: new auth revokes previous session.",
    parameters: authParamsSchema,
    execute: async (args: unknown) => {
      const params = authParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerColdStartTool(server: FastMCP, tool: ColdStartTool): void {
  server.addTool({
    name: "cold_start",
    description:
      "Import full career history via multi-turn conversation. Agent extracts contexts and trails from markdown/text resume. Returns status: collecting/awaiting_clarification/awaiting_confirmation/complete.",
    parameters: coldStartParamsSchema,
    execute: async (args: unknown) => {
      const params = coldStartParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerResetColdStartTool(server: FastMCP, tool: ResetColdStartTool): void {
  server.addTool({
    name: "reset_cold_start",
    description: "Reset cold start status and clear checkpoint. Allows user to restart career history import.",
    parameters: resetColdStartParamsSchema,
    execute: async (args: unknown) => {
      const params = resetColdStartParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerGetStoryTool(server: FastMCP, tool: GetStoryTool): void {
  server.addTool({
    name: "get_story",
    description: "Get career story (contexts and trails) for a user",
    parameters: getStoryParamsSchema,
    execute: async (args: unknown) => {
      const params = getStoryParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerSearchCareersTool(server: FastMCP, tool: SearchCareersTool): void {
  server.addTool({
    name: "search_careers",
    description:
      "Search for career transition paths with custom context. LibreChat LLM extracts structured context from user text.",
    parameters: facadeAdhocSearchParamsSchema,
    execute: async (args: unknown) => {
      const params = facadeAdhocSearchParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerSearchUserCareersTool(server: FastMCP, tool: SearchUserCareersTool): void {
  server.addTool({
    name: "search_user_careers",
    description:
      "Search for career paths based on user's current context (fetched from DB automatically). No need to provide referenceContext.",
    parameters: searchUserCareersParamsSchema,
    execute: async (args: unknown) => {
      const params = searchUserCareersParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerGoalTools(server: FastMCP, tools: ToolInstances): void {
  server.addTool({
    name: "set_goal",
    description: "Set career goal with target context criteria",
    parameters: setGoalParamsSchema,
    execute: async (args: unknown) => {
      const params = setGoalParamsSchema.parse(args);
      const result = await tools.setGoal.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });

  server.addTool({
    name: "get_goal",
    description: "Get user's career goal (current or specific user)",
    parameters: getGoalParamsSchema,
    execute: async (args: unknown) => {
      const params = getGoalParamsSchema.parse(args);
      const result = await tools.getGoal.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });

  server.addTool({
    name: "delete_goal",
    description: "Delete user's career goal",
    parameters: deleteGoalParamsSchema,
    execute: async (args: unknown) => {
      const params = deleteGoalParamsSchema.parse(args);
      const result = await tools.deleteGoal.execute(params);
      if (result.ok) {
        return JSON.stringify({ success: true }, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerContextTools(server: FastMCP, tools: ToolInstances): void {
  server.addTool({
    name: "update_context",
    description: "Update current context via natural language message",
    parameters: updateContextParamsSchema,
    execute: async (args: unknown) => {
      const params = updateContextParamsSchema.parse(args);
      const result = await tools.updateContext.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });

  server.addTool({
    name: "upsert_context",
    description: "Create or update a single context",
    parameters: upsertContextParamsSchema,
    execute: async (args: unknown) => {
      const params = upsertContextParamsSchema.parse(args);
      const result = await tools.upsertContext.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });

  server.addTool({
    name: "delete_context",
    description: "Delete a specific context from user's history",
    parameters: deleteContextParamsSchema,
    execute: async (args: unknown) => {
      const params = deleteContextParamsSchema.parse(args);
      const result = await tools.deleteContext.execute(params);
      if (result.ok) {
        return JSON.stringify({ success: true }, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerSearchByTargetTool(server: FastMCP, tool: SearchByTargetTool): void {
  server.addTool({
    name: "search_by_target",
    description: "Reverse search: find users who have already achieved the target position/criteria",
    parameters: searchByTargetParamsSchema,
    execute: async (args: unknown) => {
      const params = searchByTargetParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerTrailTools(server: FastMCP, tools: ToolInstances): void {
  server.addTool({
    name: "upsert_trail",
    description: "Create or update a learning trail (course, certification, etc.)",
    parameters: upsertTrailParamsSchema,
    execute: async (args: unknown) => {
      const params = upsertTrailParamsSchema.parse(args);
      const result = await tools.upsertTrail.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throwToolError(result.error);
    },
  });

  server.addTool({
    name: "delete_trail",
    description: "Delete a specific trail from user's history",
    parameters: deleteTrailParamsSchema,
    execute: async (args: unknown) => {
      const params = deleteTrailParamsSchema.parse(args);
      const result = await tools.deleteTrail.execute(params);
      if (result.ok) {
        return JSON.stringify({ success: true }, null, 2);
      }
      throwToolError(result.error);
    },
  });
}

function registerTelegramAuthTools(server: FastMCP, authService: AuthService): void {
  server.addTool({
    name: "register_telegram",
    description:
      "Register or authenticate user via Telegram. Idempotent: returns existing user if telegram_user_id already registered. " +
      "Returns userId, token (for linking to LibreChat), and sessionId.",
    parameters: telegramRegisterParamsSchema,
    execute: async (args: unknown) => {
      const params = telegramRegisterParamsSchema.parse(args);
      const result = await authService.registerViaTelegram({
        telegramUserId: params.telegramUserId,
      });
      return JSON.stringify(result, null, 2);
    },
  });

  server.addTool({
    name: "link_telegram",
    description:
      "Link Telegram account to existing LibreChat account using token. " +
      "User provides token from LibreChat, bot links their Telegram ID to that account.",
    parameters: telegramLinkParamsSchema,
    execute: async (args: unknown) => {
      const params = telegramLinkParamsSchema.parse(args);
      const result = await authService.linkTelegram(params.token, {
        telegramUserId: params.telegramUserId,
      });
      return JSON.stringify(result, null, 2);
    },
  });
}

function registerTools(server: FastMCP, tools: ToolInstances, authService: AuthService): void {
  registerAuthTool(server, tools.auth);
  registerTelegramAuthTools(server, authService);
  registerColdStartTool(server, tools.coldStart);
  registerResetColdStartTool(server, tools.resetColdStart);
  registerGetStoryTool(server, tools.getStory);
  registerSearchCareersTool(server, tools.searchCareers);
  registerSearchUserCareersTool(server, tools.searchUserCareers);
  registerSearchByTargetTool(server, tools.searchByTarget);
  registerGoalTools(server, tools);
  registerContextTools(server, tools);
  registerTrailTools(server, tools);
}

export function createMcpServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: "waymates-facade",
    version: "3.2.0",
    instructions:
      "WayMates MCP Server. Provides 17 tools for career operations: " +
      "Auth (auth, register_telegram, link_telegram), " +
      "Cold Start (cold_start, reset_cold_start), " +
      "Story (get_story), " +
      "Search (search_careers, search_user_careers, search_by_target), " +
      "Goals (set_goal, get_goal, delete_goal), " +
      "Contexts (update_context, upsert_context, delete_context), " +
      "Trails (upsert_trail, delete_trail). " +
      "Supports both LibreChat (stdio) and Telegram Bot (HTTP) clients.",
  });

  const tools = createToolInstances(deps);
  registerTools(server, tools, deps.authService);

  return server;
}
