import { FastMCP } from "fastmcp";
import type { SearchManager } from "./search-manager.js";
import type { PersistenceManager } from "./persistence-manager.js";
import type { SkillCategoriesManager } from "./skill-categories-manager.js";
import {
  CurrentToTargetParamsSchema,
  CurrentOnlyParamsSchema,
  CurrentOnlyReasonParamsSchema,
  TargetOnlyReasonParamsSchema,
  TargetOnlyParamsSchema,
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

  // Current Only
  server.addTool(
    tool(
      "current_only",
      "Analyze career progression for current context over time",
      CurrentOnlyParamsSchema,
      async (params) =>
        searchManager.searchCurrentContext(
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
        searchManager.searchTargetContext(
          params.targetPreset,
          params.targetContext,
          params.currentUserId,
          params.searchConstraints
        )
    )
  );

  // Current Only - Reason Based (NEW)
  server.addTool(
    tool(
      "current_only_reason_based",
      "Analyze career progression grouped by life event combinations (reason-based grouping)",
      CurrentOnlyReasonParamsSchema,
      async (params) =>
        searchManager.searchCurrentReasonBased(params)
    )
  );

  // Target Only - Reason Based (NEW)
  server.addTool(
    tool(
      "target_only_reason_based",
      "Analyze who achieved target position, grouped by life event combinations that led to it",
      TargetOnlyReasonParamsSchema,
      async (params) =>
        searchManager.searchTargetReasonBased(params)
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
