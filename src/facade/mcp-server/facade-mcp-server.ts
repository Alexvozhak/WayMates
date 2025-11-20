import { FastMCP } from "fastmcp";

import {
  getStoryParamsSchema,
  searchCareersParamsSchema,
  searchUserCareersParamsSchema,
  setGoalParamsSchema,
  updateContextToolParamsSchema,
} from "./schemas.js";
import { GetStoryTool } from "./tools/get-story.tool.js";
import { SearchCareersTool } from "./tools/search-careers.tool.js";
import { SearchUserCareersTool } from "./tools/search-user-careers.tool.js";
import { SetGoalTool } from "./tools/set-goal.tool.js";
import { UpdateContextTool } from "./tools/update-context.tool.js";

import type { SessionMiddleware } from "./session-middleware.js";
import type { SimpleNormalizer } from "./simple-normalizer.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";

export type FacadeServerDependencies = {
  sessionMiddleware: SessionMiddleware;
  normalizer: SimpleNormalizer;
  coreClient: CoreTRPCClient;
};

type ToolInstances = {
  getStory: GetStoryTool;
  searchCareers: SearchCareersTool;
  searchUserCareers: SearchUserCareersTool;
  setGoal: SetGoalTool;
  updateContext: UpdateContextTool;
};

function createToolInstances(deps: FacadeServerDependencies): ToolInstances {
  return {
    getStory: new GetStoryTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchCareers: new SearchCareersTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchUserCareers: new SearchUserCareersTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
    setGoal: new SetGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    updateContext: new UpdateContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
  };
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });
}

function registerSearchCareersTool(server: FastMCP, tool: SearchCareersTool): void {
  server.addTool({
    name: "search_careers",
    description:
      "Search for career transition paths with custom context. LibreChat LLM extracts structured context from user text.",
    parameters: searchCareersParamsSchema,
    execute: async (args: unknown) => {
      const params = searchCareersParamsSchema.parse(args);
      const result = await tool.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });
}

function registerGoalAndUpdateTools(server: FastMCP, tools: ToolInstances): void {
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });

  server.addTool({
    name: "update_context",
    description: "Update current context (partial update of mutable fields only)",
    parameters: updateContextToolParamsSchema,
    execute: async (args: unknown) => {
      const params = updateContextToolParamsSchema.parse(args);
      const result = await tools.updateContext.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });
}

function registerTools(server: FastMCP, tools: ToolInstances): void {
  registerGetStoryTool(server, tools.getStory);
  registerSearchCareersTool(server, tools.searchCareers);
  registerSearchUserCareersTool(server, tools.searchUserCareers);
  registerGoalAndUpdateTools(server, tools);
}

export function createFacadeServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: "waymates-facade",
    version: "2.1.0",
    instructions:
      "WayMates MCP Server. Provides 5 tools for career operations: get_story, search_careers (adhoc with custom context), search_user_careers (based on user's current context from DB), set_goal, update_context. LibreChat LLM handles text-to-JSON extraction.",
  });

  const tools = createToolInstances(deps);
  registerTools(server, tools);

  return server;
}
