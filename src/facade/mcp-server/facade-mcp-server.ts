import { FastMCP } from "fastmcp";

import {
  coldStartParamsSchema,
  deleteContextParamsSchema,
  deleteGoalParamsSchema,
  deleteTrailParamsSchema,
  facadeAdhocSearchParamsSchema,
  getGoalParamsSchema,
  getStoryParamsSchema,
  searchByTargetParamsSchema,
  searchUserCareersParamsSchema,
  setGoalParamsSchema,
  updateContextToolParamsSchema,
  upsertContextParamsSchema,
  upsertTrailParamsSchema,
} from "./schemas.js";
import { ColdStartTool } from "./tools/cold-start.tool.js";
import { DeleteContextTool } from "./tools/delete-context.tool.js";
import { DeleteGoalTool } from "./tools/delete-goal.tool.js";
import { DeleteTrailTool } from "./tools/delete-trail.tool.js";
import { throwToolError } from "./tools/errors.js";
import { GetGoalTool } from "./tools/get-goal.tool.js";
import { GetStoryTool } from "./tools/get-story.tool.js";
import { SearchByTargetTool } from "./tools/search-by-target.tool.js";
import { SearchCareersTool } from "./tools/search-careers.tool.js";
import { SearchUserCareersTool } from "./tools/search-user-careers.tool.js";
import { SetGoalTool } from "./tools/set-goal.tool.js";
import { UpdateContextTool } from "./tools/update-context.tool.js";
import { UpsertContextTool } from "./tools/upsert-context.tool.js";
import { UpsertTrailTool } from "./tools/upsert-trail.tool.js";

import type { SessionMiddleware } from "./session-middleware.js";
import type { Normalizer } from "./tools/base-tool.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";

export type FacadeServerDependencies = {
  sessionMiddleware: SessionMiddleware;
  normalizer: Normalizer;
  coreClient: CoreTRPCClient;
};

type ToolInstances = {
  coldStart: ColdStartTool;
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
  return {
    coldStart: new ColdStartTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    getStory: new GetStoryTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchCareers: new SearchCareersTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchUserCareers: new SearchUserCareersTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
    setGoal: new SetGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    updateContext: new UpdateContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    getGoal: new GetGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    deleteGoal: new DeleteGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchByTarget: new SearchByTargetTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
    deleteContext: new DeleteContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    upsertContext: new UpsertContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    upsertTrail: new UpsertTrailTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    deleteTrail: new DeleteTrailTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
  };
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
    description: "Update current context (partial update of mutable fields only)",
    parameters: updateContextToolParamsSchema,
    execute: async (args: unknown) => {
      const params = updateContextToolParamsSchema.parse(args);
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
    description:
      "Reverse search: find users who have already achieved the target position/criteria",
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

function registerTools(server: FastMCP, tools: ToolInstances): void {
  registerColdStartTool(server, tools.coldStart);
  registerGetStoryTool(server, tools.getStory);
  registerSearchCareersTool(server, tools.searchCareers);
  registerSearchUserCareersTool(server, tools.searchUserCareers);
  registerSearchByTargetTool(server, tools.searchByTarget);
  registerGoalTools(server, tools);
  registerContextTools(server, tools);
  registerTrailTools(server, tools);
}

export function createFacadeServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: "waymates-facade",
    version: "3.0.0",
    instructions:
      "WayMates MCP Server. Provides 13 tools for career operations: " +
      "Cold Start (cold_start), " +
      "Story (get_story), " +
      "Search (search_careers, search_user_careers, search_by_target), " +
      "Goals (set_goal, get_goal, delete_goal), " +
      "Contexts (update_context, upsert_context, delete_context), " +
      "Trails (upsert_trail, delete_trail). " +
      "LibreChat LLM handles text-to-JSON extraction.",
  });

  const tools = createToolInstances(deps);
  registerTools(server, tools);

  return server;
}
