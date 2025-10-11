import { FastMCP } from "fastmcp";
import type { SearchManager } from "./search-manager.js";
import {
  executeUpsertStory,
  executeUpsertContexts,
  executeUpsertTrails,
} from "./upsert-story.js";
import {
  getUserStory,
  deleteContext,
  deleteTrail,
  pingDatabase,
} from "./mcp-tools.js";
import {
  CurrentToTargetParamsSchema,
  CurrentOnlyParamsSchema,
  TargetOnlyParamsSchema,
  TargetSearchParamsSchema,
  StoryInputSchema,
  UserIdContextSchema,
  UserIdTrailSchema,
  GetUserStoryParamsSchema,
  DeleteContextParamsSchema,
  DeleteTrailParamsSchema,
  PingParamsSchema,
} from "./schemas-zod.js";
import { z } from "zod";

/**
 * Create MCP server using SearchManager.
 */
export function createWayMatesServer(searchManager: SearchManager) {
  const server = new FastMCP({
    name: "waymates-search",
    version: "1.0.0",
    instructions:
      "WayMates career search and analysis server. Provides tools for career transition analysis, progression tracking, and target position exploration.",
  });

  // Current to Target
  server.addTool(
    tool(
      "current_to_target",
      "Find career transitions from current context to target position",
      CurrentToTargetParamsSchema,
      async (params) =>
        searchManager.searchPipeline(
          params.currentPreset,
          params.currentContext,
          params.targetPreset,
          params.targetContext,
          params.currentUserId,
          params.searchConstraints
        )
    )
  );

  // Current Only
  server.addTool(
    tool(
      "current_only",
      "Analyze career progression for current context over time",
      CurrentOnlyParamsSchema,
      async (params) =>
        searchManager.searchCurrent(
          params.currentPreset,
          params.currentContext,
          params.currentUserId,
          params.searchConstraints
        )
    )
  );

  // Target Only
  server.addTool(
    tool(
      "target_only",
      "Analyze career paths and requirements to reach target position",
      TargetOnlyParamsSchema,
      async (params) =>
        searchManager.searchTarget(
          params.targetPreset,
          params.targetContext,
          params.currentUserId,
          params.searchConstraints
        )
    )
  );

  // Target Search
  server.addTool(
    tool(
      "target_search",
      "Search users who have achieved the target position",
      TargetSearchParamsSchema,
      async (params) =>
        searchManager.searchTargetMode(
          params.targetPreset,
          params.targetContext,
          params.currentUserId,
          params.searchConstraints
        )
    )
  );

  // Upsert Story
  server.addTool(
    tool(
      "execute_upsert_story",
      "Process complete user story with contexts and trails",
      StoryInputSchema,
      (params) => executeUpsertStory(searchManager.driver, params)
    )
  );
  // Upsert Context
  server.addTool(
    tool(
      "upsert_context",
      "Create or update single user context",
      UserIdContextSchema,
      (params) => executeUpsertContexts(searchManager.driver, params)
    )
  );
  // Upsert Trail
  server.addTool(
    tool(
      "upsert_trail",
      "Create or update single trail between contexts",
      UserIdTrailSchema,
      (params) => executeUpsertTrails(searchManager.driver, params)
    )
  );
  // Get User Story
  server.addTool(
    tool(
      "get_user_story",
      "Fetch stored contexts and trails for a user",
      GetUserStoryParamsSchema,
      (params) => getUserStory(searchManager.driver, params)
    )
  );
  // Delete Context
  server.addTool(
    tool(
      "delete_context",
      "Delete a context owned by the user (requires no trails)",
      DeleteContextParamsSchema,
      (params) => deleteContext(searchManager.driver, params)
    )
  );
  // Delete Trail
  server.addTool(
    tool(
      "delete_trail",
      "Delete a specific trail owned by the user",
      DeleteTrailParamsSchema,
      (params) => deleteTrail(searchManager.driver, params)
    )
  );
  // Ping
  server.addTool(
    tool("ping", "Check database connectivity", PingParamsSchema, () =>
      pingDatabase(searchManager.driver)
    )
  );

  function tool<TParams, TResult>(
    name: string,
    description: string,
    schema: z.ZodSchema<TParams>,
    handler: (params: TParams) => Promise<TResult>
  ) {
    return {
      name,
      description,
      parameters: schema,
      execute: async (args: unknown) => {
        const parsed = schema.parse(args);
        const result = await handler(parsed);
        return JSON.stringify(result, null, 2);
      },
    };
  }

  return server;
}
