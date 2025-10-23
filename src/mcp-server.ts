import { FastMCP } from "fastmcp";
import type { SearchManager } from "./search-manager.js";
import type { PersistenceManager } from "./persistence-manager.js";
import type { SkillCategoriesManager } from "./skill-categories-manager.js";
import {
  CurrentToTargetParamsSchema,
  CurrentOnlyReasonParamsSchema,
  TargetOnlyReasonParamsSchema,
  GdsSimilaritySearchParamsSchema,
  StoryInputSchema,
  UserIdContextSchema,
  UserIdTrailSchema,
  GetUserStoryParamsSchema,
  DeleteContextParamsSchema,
  DeleteTrailParamsSchema,
  PingParamsSchema,
  ListSkillCategoryTemplatesParamsSchema,
  ApplySkillCategoryTemplateParamsSchema,
  ListSkillCategoriesParamsSchema,
  CreateCustomSkillCategoryParamsSchema,
  AssignSkillToCategoryParamsSchema,
} from "./schemas-zod.js";
import { z } from "zod";
//tODO заменить все params на CurrentToTargetParamsSchema
// в методах searchPipeline и searchCurrent и тд (не мельчить)"
/**
 * Create MCP server using SearchManager.
 */
export function createWayMatesServer(
  searchManager: SearchManager,
  persistenceManager: PersistenceManager,
  skillCategoriesManager: SkillCategoriesManager
) {
  const server = new FastMCP({
    name: "waymates-search",
    version: "1.0.0",
    instructions:
      "WayMates career search and analysis server. Provides tools for career transition analysis, progression tracking, and target position exploration.",
  });

  // Helper function to create typed MCP tools
  function tool<TParams, TResult>(
    name: string,
    description: string,
    schema: z.ZodSchema<TParams>,
    handler: (params: TParams) => Promise<TResult> | TResult
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

  // Current Only Mode (grouped by reasons)
  server.addTool(
    tool(
      "current_only_mode",
      "Analyze career progression grouped by life event combinations from current position",
      CurrentOnlyReasonParamsSchema,
      async (params) =>
        searchManager.searchCurrentOnlyMode(params)
    )
  );

  // Target Only Mode (grouped by reasons)
  server.addTool(
    tool(
      "target_only_mode",
      "Analyze who achieved target position, grouped by life event combinations that led to it",
      TargetOnlyReasonParamsSchema,
      async (params) =>
        searchManager.searchTargetOnlyMode(params)
    )
  );

  // === GDS SIMILARITY SEARCH (Week 2 Day 4) ===

  // Find Similar Contexts using GDS Node Similarity (Jaccard/Overlap)
  server.addTool(
    tool(
      "find_similar_contexts",
      "Find similar career contexts using GDS Node Similarity algorithms (10x-100x faster than manual Jaccard). Use Jaccard for current-only (strict), Overlap for target-only (lenient).",
      GdsSimilaritySearchParamsSchema,
      async (params) =>
        searchManager.searchSimilarityBased(params)
    )
  );

  // === GDS PATHFINDING (Week 2 Day 4 Part 2) ===

  // Find K Shortest Paths (Direct GDS wrapper)
  server.addTool(
    tool(
      "find_k_shortest_paths",
      "Find K shortest career paths between two contexts using Yen's algorithm. Returns paths ordered by total cost (trail durations).",
      z.object({
        sourceContextId: z.string().describe("Starting context ID"),
        targetContextId: z.string().describe("Target context ID"),
        k: z.number().int().min(1).max(10).optional().describe("Number of shortest paths (default: 3)"),
      }).strict(),
      async (params) =>
        searchManager.findKShortestPaths(params.sourceContextId, params.targetContextId, params.k)
    )
  );

  // Pipeline with Pathfinding (GDS Similarity + Yen's K-Shortest)
  server.addTool(
    tool(
      "find_pipeline_with_pathfinding",
      "Combines GDS similarity search with pathfinding: finds similar contexts at target position, then shows K shortest paths to reach them.",
      z.object({
        searchContextId: z.string().describe("Starting context ID"),
        targetPosition: z.string().describe("Target position to reach"),
        algorithm: z.enum(['Jaccard', 'Overlap']).describe("Similarity algorithm"),
        k: z.number().int().min(1).max(10).optional().describe("Number of paths per context (default: 3)"),
        topK: z.number().int().min(1).max(100).optional().describe("Max similar contexts (default: 10)"),
        similarityCutoff: z.number().min(0).max(1).optional().describe("Min similarity threshold (default: 0.0)"),
      }).strict(),
      async (params) =>
        searchManager.searchPipelineWithPathfinding({
          searchContextId: params.searchContextId,
          targetPosition: params.targetPosition,
          algorithm: params.algorithm,
          ...(params.k !== undefined && { k: params.k }),
          ...(params.topK !== undefined && { topK: params.topK }),
          ...(params.similarityCutoff !== undefined && { similarityCutoff: params.similarityCutoff }),
        })
    )
  );

  // === REASON ANALYTICS (Week 2 Day 4 Part 2) ===

  // Get Duration Statistics by Reason
  server.addTool(
    tool(
      "get_duration_by_reason",
      "Get duration statistics (avg, median, percentiles) for each creation_reason type. Helps analyze how long transitions take based on life events.",
      z.object({}).strict(),
      async () =>
        searchManager.getDurationByReason()
    )
  );

  // Get Reason Transition Matrix
  server.addTool(
    tool(
      "get_reason_transitions",
      "Get reason transition probabilities: P(to_reason | current_reason). Analyzes 3-hop patterns to predict next life events.",
      z.object({}).strict(),
      async () =>
        searchManager.getReasonTransitionMatrix()
    )
  );

  // Get Reason Co-occurrence
  server.addTool(
    tool(
      "get_reason_cooccurrence",
      "Get reason pairs that appear together in same context. Identifies common life event combinations.",
      z.object({}).strict(),
      async () =>
        searchManager.getReasonCooccurrence()
    )
  );

  // List Available Reasons (NEW)
  server.addTool(
    tool(
      "list_available_reasons",
      "Get all available context creation reasons (life events) from the database",
      z.object({}).strict(),
      async () =>
        persistenceManager.listAvailableReasons()
    )
  );

  // Create New Reason (NEW)
  server.addTool(
    tool(
      "create_new_reason",
      "Create a new context creation reason when AI encounters an unknown life event",
      z.object({
        reason_id: z.string().describe("Unique reason identifier (snake_case)"),
        description: z.string().describe("Human-readable description of the reason"),
        patterns: z.array(z.string()).describe("Common patterns/phrases indicating this reason"),
        examples: z.array(z.string()).describe("Example sentences using this reason"),
        context_id: z.string().describe("Context ID where this reason was first encountered"),
      }).strict(),
      async (params) =>
        persistenceManager.createNewReason(
          params.reason_id,
          params.description,
          params.patterns,
          params.examples,
          params.context_id
        )
    )
  );

  // Upsert Story
  server.addTool(
    tool(
      "execute_upsert_story",
      "Process complete user story with contexts and trails",
      StoryInputSchema,
      (params) => persistenceManager.upsertStory(params)
    )
  );
  // Upsert Context
  server.addTool(
    tool(
      "upsert_context",
      "Create or update single user context",
      UserIdContextSchema,
      (params) => persistenceManager.upsertContexts(params)
    )
  );
  // Upsert Trail
  server.addTool(
    tool(
      "upsert_trail",
      "Create or update single trail between contexts",
      UserIdTrailSchema,
      (params) => persistenceManager.upsertTrails(params)
    )
  );
  // Get User Story
  server.addTool(
    tool(
      "get_user_story",
      "Fetch stored contexts and trails for a user",
      GetUserStoryParamsSchema,
      (params) => persistenceManager.getUserStory(params)
    )
  );
  // Delete Context
  server.addTool(
    tool(
      "delete_context",
      "Delete a context owned by the user (requires no trails)",
      DeleteContextParamsSchema,
      (params) => persistenceManager.deleteContext(params)
    )
  );
  // Delete Trail
  server.addTool(
    tool(
      "delete_trail",
      "Delete a specific trail owned by the user",
      DeleteTrailParamsSchema,
      (params) => persistenceManager.deleteTrail(params)
    )
  );
  // Ping
  server.addTool(
    tool("ping", "Check database connectivity", PingParamsSchema, () =>
      persistenceManager.ping()
    )
  );

  // === SKILL CATEGORY MANAGEMENT TOOLS ===

  // List Skill Category Templates
  server.addTool(
    tool(
      "list_skill_category_templates",
      "Get available skill category templates for different domains (IT, healthcare, finance, etc.)",
      ListSkillCategoryTemplatesParamsSchema,
      () => skillCategoriesManager.listSkillCategoryTemplates()
    )
  );

  // Apply Skill Category Template
  server.addTool(
    tool(
      "apply_skill_category_template",
      "Apply predefined skill category template to create categories and assign skills to them",
      ApplySkillCategoryTemplateParamsSchema,
      (params) =>
        skillCategoriesManager.applySkillCategoryTemplate(
          params.template_name,
          params.domain_prefix
        )
    )
  );

  // List Skill Categories
  server.addTool(
    tool(
      "list_skill_categories",
      "Get all skill categories with weights and assigned skills from database",
      ListSkillCategoriesParamsSchema,
      (params) =>
        skillCategoriesManager.listSkillCategories(params.template_name)
    )
  );

  // Create Custom Skill Category
  server.addTool(
    tool(
      "create_custom_skill_category",
      "Create custom skill category (admin only, not from template)",
      CreateCustomSkillCategoryParamsSchema,
      (params) => skillCategoriesManager.createCustomSkillCategory(params)
    )
  );

  // Assign Skill to Category
  server.addTool(
    tool(
      "assign_skill_to_category",
      "Assign skill to existing category",
      AssignSkillToCategoryParamsSchema,
      (params) => skillCategoriesManager.assignSkillToCategory(params)
    )
  );

  return server;
}
