import { FastMCP } from "fastmcp";
import type { SearchManager } from "./search-manager.js";
import type { PersistenceManager } from "./persistence-manager.js";
import type { SkillCategoriesManager } from "./skill-categories-manager.js";
import {
  CurrentToTargetParamsSchema,
  CurrentOnlyParamsSchema,
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
