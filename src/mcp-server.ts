import { FastMCP } from "fastmcp";
import type { Driver } from "neo4j-driver";
import { executeCurrentToTarget } from "./search-modes/current-to-target.js";
import { executeCurrentOnly } from "./search-modes/current-only.js";
import { executeTargetOnly } from "./search-modes/target-only.js";
import { executeTargetSearch } from "./search-modes/target-search.js";
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
import type { PresetsManager } from "./orcestrator/preset-manager.js";
import { z } from "zod";

export function createWayMatesServer(
  driver: Driver,
  presetsManager: PresetsManager
) {
  presetsManager.load();
  const server = new FastMCP({
    name: "waymates-search",
    version: "1.0.0",
    instructions:
      "WayMates career search and analysis server. Provides tools for career transition analysis, progression tracking, and target position exploration.",
  });

  // Current to Target - Find career transitions from current context to target position
  server.addTool(
    tool(
      "current_to_target",
      "Find career transitions from current context to target position",
      CurrentToTargetParamsSchema,
      executeCurrentToTarget
    )
  );

  // Current Only - Analyze career progression for current context
  server.addTool(
    tool(
      "current_only",
      "Analyze career progression for current context over time",
      CurrentOnlyParamsSchema,
      executeCurrentOnly
    )
  );

  // Target Only - Analyze career paths to target position
  server.addTool(
    tool(
      "target_only",
      "Analyze career paths and requirements to reach target position",
      TargetOnlyParamsSchema,
      executeTargetOnly
    )
  );

  // Target Search - Search users by target context
  server.addTool(
    tool(
      "target_search",
      "Search users who have achieved the target position",
      TargetSearchParamsSchema,
      executeTargetSearch
    )
  );

  // Execute Upsert Story - Process complete user story with contexts and trails
  server.addTool(
    tool(
      "execute_upsert_story",
      "Process complete user story with contexts and trails",
      StoryInputSchema,
      executeUpsertStory
    )
  );

  // Upsert Context - Create or update single user context
  server.addTool(
    tool(
      "upsert_context",
      "Create or update single user context",
      UserIdContextSchema,
      executeUpsertContexts
    )
  );

  // Upsert Trail - Create or update single trail
  server.addTool(
    tool(
      "upsert_trail",
      "Create or update single trail between contexts",
      UserIdTrailSchema,
      executeUpsertTrails
    )
  );

  // Get User Story - Read full user contexts and trails from database
  server.addTool(
    tool(
      "get_user_story",
      "Fetch stored contexts and trails for a user",
      GetUserStoryParamsSchema,
      getUserStory
    )
  );

  // Delete Context - Remove user's context without associated trails
  server.addTool(
    tool(
      "delete_context",
      "Delete a context owned by the user (requires no trails)",
      DeleteContextParamsSchema,
      deleteContext
    )
  );

  // Delete Trail - Remove a trail belonging to the user
  server.addTool(
    tool(
      "delete_trail",
      "Delete a specific trail owned by the user",
      DeleteTrailParamsSchema,
      deleteTrail
    )
  );

  // Ping - Health check
  server.addTool(
    tool(
      "ping",
      "Check database connectivity",
      PingParamsSchema,
      async (driver) => pingDatabase(driver)
    )
  );

  // Load Presets - Load presets from configuration file
  server.addTool(
    tool(
      "load_presets",
      "Load presets from configuration file",
      z.object({}),
      () => {
        presetsManager.load();
        return { success: true, message: "Presets loaded successfully" };
      }
    )
  );

  // Get Preset - Get specific preset configuration by name
  server.addTool(
    tool(
      "get_preset",
      "Get specific preset configuration by name",
      z.object({ preset: z.string() }),
      (_, { preset }) => presetsManager.get(preset)
    )
  );

  // Get Presets - Get all available search presets
  server.addTool(
    tool(
      "get_presets",
      "Get all available search configuration presets",
      z.object({}),
      () => presetsManager.getAll()
    )
  );

  function tool<TParams, TResult>(
    name: string,
    description: string,
    schema: z.ZodSchema<TParams>,
    handler: (driver: Driver, params: TParams) => Promise<TResult>
  ) {
    return {
      name,
      description,
      parameters: schema,
      execute: async (args: unknown) => {
        const parsed = schema.parse(args);
        const result = await handler(driver, parsed);
        return JSON.stringify(result, null, 2);
      },
    };
  }

  return server;
}
