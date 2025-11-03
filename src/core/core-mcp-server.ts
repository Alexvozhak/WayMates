import { FastMCP } from "fastmcp";
import { z } from "zod";
import type { SearchManager as NewSearchManager } from "./search-manager.js";
import type { StoryManager } from "./story-manager.js";
import type { GoalsManager } from "./goals-manager.js";
import {
  StoryInputSchema,
  CreateGoalInputSchema,
  UserIdSchema,
  GoalIdSchema,
} from "../shared/schemas.js";
import {
  AdHocSearchParamsSchema,
  SavedCurrentSearchParamsSchema,
  TrajectorySearchParamsSchema,
  TargetOnlySearchParamsSchema,
} from "./schemas.js";

interface CoreContext {
  newSearchManager?: NewSearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
}

// Helper function to create typed MCP tools (not exported - duplicated in facade)
function tool<TSchema extends z.ZodTypeAny, TResult>(
  name: string,
  description: string,
  schema: TSchema,
  handler: (params: z.infer<TSchema>) => Promise<TResult> | TResult
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

function registerNewSearchTools(server: FastMCP, context: CoreContext) {
  if (!context.newSearchManager) {
    return;
  }

  server.addTool(
    tool(
      "execute_search_ad_hoc",
      "Ad-hoc search without registration (no DTW, no Goal filter)",
      AdHocSearchParamsSchema,
      async (params) => context.newSearchManager!.searchAdHoc(params)
    )
  );

  server.addTool(
    tool(
      "execute_search_saved_current",
      "Search from saved current context (single context, no trajectory, with Goal filter)",
      SavedCurrentSearchParamsSchema,
      async (params) => context.newSearchManager!.searchSavedCurrent(params)
    )
  );

  server.addTool(
    tool(
      "execute_search_trajectory",
      "Search from trajectory (with DTW metrics, with Goal filter)",
      TrajectorySearchParamsSchema,
      async (params) => context.newSearchManager!.searchTrajectory(params)
    )
  );

  server.addTool(
    tool(
      "execute_search_target_only",
      "Reverse search by target position (no reference context, no DTW, no Goal filter)",
      TargetOnlySearchParamsSchema,
      async (params) => context.newSearchManager!.searchTargetOnly(params)
    )
  );
}

function registerStoryTools(server: FastMCP, context: CoreContext) {
  server.addTool(
    tool(
      "execute_upsert_story",
      "Save or update user career history",
      StoryInputSchema,
      async (params) => context.storyManager.upsertStory(params)
    )
  );

  server.addTool(
    tool(
      "get_user_story",
      "Get user's complete career history (contexts + trails)",
      z.object({ userId: UserIdSchema }),
      async (params) => context.storyManager.getUserStory(params.userId)
    )
  );

  server.addTool(
    tool(
      "delete_context",
      "Delete a specific context from user's career history",
      z.object({
        userId: UserIdSchema,
        contextId: z.string(),
      }),
      async (params) =>
        context.storyManager.deleteContext(params.userId, params.contextId)
    )
  );

  server.addTool(
    tool(
      "delete_trail",
      "Delete a specific learning trail",
      z.object({
        userId: UserIdSchema,
        trailId: z.string(),
      }),
      async (params) =>
        context.storyManager.deleteTrail(params.userId, params.trailId)
    )
  );
}

function registerReasonTools(server: FastMCP, context: CoreContext) {
  server.addTool(
    tool(
      "list_available_reasons",
      "List all available context creation reasons (for AI and admins)",
      z.object({}),
      async () => context.storyManager.listAvailableReasons()
    )
  );

  server.addTool(
    tool(
      "create_new_reason",
      "Create new context creation reason (admin tool for AI discovery)",
      z.object({
        reasonId: z.string(),
        description: z.string(),
        patterns: z.array(z.string()),
        examples: z.array(z.string()),
        contextId: z.string(),
      }),
      async (params) =>
        context.storyManager.createNewReason(
          params.reasonId,
          params.description,
          params.patterns,
          params.examples,
          params.contextId
        )
    )
  );
}

function registerGoalTools(server: FastMCP, context: CoreContext) {
  server.addTool(
    tool(
      "createGoal",
      "Create new career goal",
      CreateGoalInputSchema,
      async (params) => context.goalsManager.createGoal(params)
    )
  );

  server.addTool(
    tool(
      "getUserGoalContexts",
      "Get all goals with full context for a user",
      z.object({ userId: UserIdSchema }),
      async (params) => context.goalsManager.getUserGoalContexts(params.userId)
    )
  );

  server.addTool(
    tool(
      "deleteGoal",
      "Delete career goal",
      z.object({
        goalId: GoalIdSchema,
        userId: UserIdSchema,
      }),
      async (params) =>
        context.goalsManager.deleteGoal(params.goalId, params.userId)
    )
  );
}

export function createCoreServer(context: CoreContext) {
  const server = new FastMCP({
    name: "waymates-core",
    version: "1.0.0",
    instructions:
      "WayMates Core server with strict JSON interface. Handles career search, story, and goals.",
  });

  registerNewSearchTools(server, context);
  registerStoryTools(server, context);
  registerReasonTools(server, context);
  registerGoalTools(server, context);

  return server;
}
