import { FastMCP } from "fastmcp";

import {
  getStoryParamsSchema,
  searchCareersParamsSchema,
  setGoalParamsSchema,
  updateContextToolParamsSchema,
} from "./schemas.js";
import { GetStoryTool } from "./tools/get-story.tool.js";
import { SearchCareersTool } from "./tools/search-careers.tool.js";
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
  setGoal: SetGoalTool;
  updateContext: UpdateContextTool;
};

function createToolInstances(deps: FacadeServerDependencies): ToolInstances {
  return {
    getStory: new GetStoryTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchCareers: new SearchCareersTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    setGoal: new SetGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    updateContext: new UpdateContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
  };
}

function registerTools(server: FastMCP, tools: ToolInstances): void {
  server.addTool({
    name: "get_story",
    description: "Get career story (contexts and trails) for a user",
    parameters: getStoryParamsSchema,
    execute: async (args: unknown) => {
      const params = getStoryParamsSchema.parse(args);
      const result = await tools.getStory.execute(params);

      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }

      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });

  server.addTool({
    name: "search_careers",
    description: "Search for career transition paths based on reference context",
    parameters: searchCareersParamsSchema,
    execute: async (args: unknown) => {
      const params = searchCareersParamsSchema.parse(args);
      const result = await tools.searchCareers.execute(params);

      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }

      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });

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

export function createFacadeServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: "waymates-facade",
    version: "2.0.0",
    instructions: "WayMates MCP Server. Provides 5 tools for career operations.",
  });

  const tools = createToolInstances(deps);
  registerTools(server, tools);

  return server;
}
