import { FastMCP } from "fastmcp";

import {
  addDictionaryTermParamsSchema,
  deleteContextParamsSchema,
  deleteGoalParamsSchema,
  getDictionariesParamsSchema,
  getGoalParamsSchema,
  getStoryParamsSchema,
  searchByTargetParamsSchema,
  searchCareersParamsSchema,
  searchUserCareersParamsSchema,
  setGoalParamsSchema,
  updateContextToolParamsSchema,
  upsertContextParamsSchema,
} from "./schemas.js";
import { AddDictionaryTermTool } from "./tools/add-dictionary-term.tool.js";
import { DeleteContextTool } from "./tools/delete-context.tool.js";
import { DeleteGoalTool } from "./tools/delete-goal.tool.js";
import { GetDictionariesTool } from "./tools/get-dictionaries.tool.js";
import { GetGoalTool } from "./tools/get-goal.tool.js";
import { GetStoryTool } from "./tools/get-story.tool.js";
import { SearchByTargetTool } from "./tools/search-by-target.tool.js";
import { SearchCareersTool } from "./tools/search-careers.tool.js";
import { SearchUserCareersTool } from "./tools/search-user-careers.tool.js";
import { SetGoalTool } from "./tools/set-goal.tool.js";
import { UpdateContextTool } from "./tools/update-context.tool.js";
import { UpsertContextTool } from "./tools/upsert-context.tool.js";

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
  getGoal: GetGoalTool;
  deleteGoal: DeleteGoalTool;
  searchByTarget: SearchByTargetTool;
  getDictionaries: GetDictionariesTool;
  deleteContext: DeleteContextTool;
  upsertContext: UpsertContextTool;
  addDictionaryTerm: AddDictionaryTermTool;
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
    getGoal: new GetGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    deleteGoal: new DeleteGoalTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    searchByTarget: new SearchByTargetTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
    getDictionaries: new GetDictionariesTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
    deleteContext: new DeleteContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    upsertContext: new UpsertContextTool(deps.sessionMiddleware, deps.normalizer, deps.coreClient),
    addDictionaryTerm: new AddDictionaryTermTool(
      deps.sessionMiddleware,
      deps.normalizer,
      deps.coreClient,
    ),
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
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
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });
}

function registerDictionariesTools(server: FastMCP, tools: ToolInstances): void {
  server.addTool({
    name: "get_dictionaries",
    description: "Get verified dictionary terms (positions, skills, domains, etc.) for validation",
    parameters: getDictionariesParamsSchema,
    execute: async (args: unknown) => {
      const params = getDictionariesParamsSchema.parse(args);
      const result = await tools.getDictionaries.execute(params);
      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });

  server.addTool({
    name: "add_dictionary_term",
    description: "Add a new term to dictionaries (verified or unverified)",
    parameters: addDictionaryTermParamsSchema,
    execute: async (args: unknown) => {
      const params = addDictionaryTermParamsSchema.parse(args);
      const result = await tools.addDictionaryTerm.execute(params);
      if (result.ok) {
        return JSON.stringify({ success: true }, null, 2);
      }
      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });
}

function registerTools(server: FastMCP, tools: ToolInstances): void {
  registerGetStoryTool(server, tools.getStory);
  registerSearchCareersTool(server, tools.searchCareers);
  registerSearchUserCareersTool(server, tools.searchUserCareers);
  registerSearchByTargetTool(server, tools.searchByTarget);
  registerGoalTools(server, tools);
  registerContextTools(server, tools);
  registerDictionariesTools(server, tools);
}

export function createFacadeServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: "waymates-facade",
    version: "3.0.0",
    instructions:
      "WayMates MCP Server. Provides 12 tools for career operations: " +
      "Story (get_story), " +
      "Search (search_careers, search_user_careers, search_by_target), " +
      "Goals (set_goal, get_goal, delete_goal), " +
      "Contexts (update_context, upsert_context, delete_context), " +
      "Dictionaries (get_dictionaries, add_dictionary_term). " +
      "LibreChat LLM handles text-to-JSON extraction.",
  });

  const tools = createToolInstances(deps);
  registerTools(server, tools);

  return server;
}
