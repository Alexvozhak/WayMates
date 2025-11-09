import { FastMCP } from "fastmcp";
import { z } from "zod";
import type { SearchManager as NewSearchManager } from "./search-manager.js";
import type { StoryManager } from "./story-manager.js";
import type { GoalsManager } from "./goals-manager.js";
import {
  StoryInputSchema,
  CreateGoalInputSchema,
  UserIdSchema,
} from "../shared/schemas.js";
import {
  SearchByContextParamsSchema,
  UserSearchParamsSchema,
  TargetSearchParamsSchema,
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

  // Режим 1: Ad-Hoc Search
  server.addTool(
    tool(
      "search_adhoc",
      "Ad-hoc search with custom reference context (userId required for Goal filter, NO DTW)",
      SearchByContextParamsSchema,
      async (params) => context.newSearchManager!.searchAdhoc(params)
    )
  );

  // Режимы 2+3: User Search (автоматический DTW)
  server.addTool(
    tool(
      "search_by_user",
      "Search from user's context (automatic DTW if trajectory exists, with Goal filter). Returns ScoredMatchedCandidate[] with optional DTW fields.",
      UserSearchParamsSchema,
      async (params) => context.newSearchManager!.searchByUser(params)
    )
  );

  // Режим 4: Target-Only Search
  server.addTool(
    tool(
      "search_by_target",
      "Reverse search by target criteria (NO userId, NO reference context, NO DTW, NO Goal filter)",
      TargetSearchParamsSchema,
      async (params) => context.newSearchManager!.searchByTarget(params)
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
  // MCP tool names use snake_case per community convention (not enforced by ESLint as they're string literals)
  server.addTool(
    tool(
      "set_goal",
      "Set or update career goal (one goal per user)",
      CreateGoalInputSchema,
      async (params) => context.goalsManager.setGoal(params)
    )
  );

  server.addTool(
    tool(
      "get_user_goal",
      "Get career goal for a user",
      z.object({ userId: UserIdSchema }),
      async (params) => context.goalsManager.getUserGoal(params.userId)
    )
  );

  server.addTool(
    tool(
      "delete_goal",
      "Delete career goal",
      z.object({
        userId: UserIdSchema,
      }),
      async (params) => context.goalsManager.deleteGoal(params.userId)
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
