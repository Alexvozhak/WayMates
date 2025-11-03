import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import type { DatabaseContext } from "./database-context.js";
import {
  SkillCategoryWithSkills,
  SkillCategoryTemplatesConfig,
  SkillCategoryWithSkillsSchema,
} from "./schemas-zod.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Manager for skill categories operations
 */
export class SkillCategoriesManager {
  constructor(private db: DatabaseContext) {}

  private async executeWrite(
    query: string,
    params: Record<string, unknown>
  ): Promise<void> {
    await this.db.write(async (tx) => {
      await tx.run(query, params);
    });
  }

  private async executeRead<T>(
    query: string,
    params: Record<string, unknown>,
    mapper: (result: unknown) => T
  ): Promise<T> {
    return this.db.read(async (tx) => {
      const result = await tx.run(query, params);
      return mapper(result);
    });
  }

  /**
   * List available skill category templates from YAML
   */
  listSkillCategoryTemplates(): {
    available_templates: Array<{
      template_name: string;
      description: string;
      categories_count: number;
      total_skills: number;
    }>;
  } {
    const templates = this.loadTemplatesFromYAML();

    return {
      available_templates: Object.entries(templates.templates).map(
        ([name, config]) => ({
          template_name: name,
          description: config.description,
          categories_count: config.categories.length,
          total_skills: config.categories.reduce(
            (sum, cat) => sum + cat.skills.length,
            0
          ),
        })
      ),
    };
  }

  /**
   * Apply skill category template to database
   */
  async applySkillCategoryTemplate(
    templateName: string,
    domainPrefix?: string
  ): Promise<{
    success: boolean;
    template_applied: string;
    categories_created: Array<{
      category_id: string;
      category_name: string;
      skills_assigned: number;
    }>;
  }> {
    const templates = this.loadTemplatesFromYAML();
    const template = templates.templates[templateName];

    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const results = [];

    for (const category of template.categories) {
      const categoryId = this.generateCategoryId(
        templateName,
        category.category_name,
        domainPrefix
      );

      // Create SkillCategory node
      await this.executeWrite(
        `
        MERGE (sc:SkillCategory {category_id: $categoryId})
        SET sc.template_name = $templateName,
            sc.category_name = $categoryName,
            sc.weight = $weight,
            sc.penalty_multiplier = $penaltyMultiplier,
            sc.is_predefined = true,
            sc.created_at = datetime()
      `,
        {
          categoryId,
          templateName,
          categoryName: category.category_name,
          weight: category.weight,
          penaltyMultiplier: category.penalty_multiplier,
        }
      );

      // Assign skills to category
      for (const skillName of category.skills) {
        await this.executeWrite(
          `
          MERGE (s:Skill {name: $skillName})
          WITH s
          MATCH (sc:SkillCategory {category_id: $categoryId})
          MERGE (s)-[:BELONGS_TO]->(sc)
        `,
          { skillName, categoryId }
        );
      }

      results.push({
        category_id: categoryId,
        category_name: category.category_name,
        skills_assigned: category.skills.length,
      });
    }

    return {
      success: true,
      template_applied: templateName,
      categories_created: results,
    };
  }

  /**
   * List all skill categories from database
   */
  async listSkillCategories(templateName?: string): Promise<{
    categories: SkillCategoryWithSkills[];
  }> {
    const query = templateName
      ? `MATCH (sc:SkillCategory {template_name: $templateName})`
      : `MATCH (sc:SkillCategory)`;

    const categories = await this.executeRead(
      `
        ${query}
        OPTIONAL MATCH (s:Skill)-[:BELONGS_TO]->(sc)
        WITH sc, collect(s.name) AS skills
        RETURN sc.category_id AS category_id,
               sc.template_name AS template_name,
               sc.category_name AS category_name,
               sc.weight AS weight,
               sc.penalty_multiplier AS penalty_multiplier,
               sc.is_predefined AS is_predefined,
               sc.created_at AS created_at,
               skills
        ORDER BY sc.weight DESC
      `,
      { templateName },
      (result: any) =>
        result.records.map((r: any) => {
          const category = {
            category_id: r.get("category_id"),
            template_name: r.get("template_name"),
            category_name: r.get("category_name"),
            weight: r.get("weight"),
            penalty_multiplier: r.get("penalty_multiplier"),
            is_predefined: r.get("is_predefined"),
            created_at: r.get("created_at"),
            skills: r.get("skills"),
          };

          return SkillCategoryWithSkillsSchema.parse(category);
        })
    );

    return { categories };
  }

  /**
   * Create custom skill category
   */
  async createCustomSkillCategory(params: {
    category_name: string;
    description: string;
    weight: number;
    penalty_multiplier: number;
    skills: string[];
    template_name?: string | undefined;
  }): Promise<{
    success: boolean;
    category_id: string;
    skills_assigned: number;
  }> {
    const categoryId = `custom_${params.category_name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

    await this.executeWrite(
      `
        MERGE (sc:SkillCategory {category_id: $categoryId})
        SET sc.category_name = $categoryName,
            sc.description = $description,
            sc.weight = $weight,
            sc.penalty_multiplier = $penaltyMultiplier,
            sc.template_name = $templateName,
            sc.is_predefined = false,
            sc.created_at = datetime()
      `,
      {
        categoryId,
        categoryName: params.category_name,
        description: params.description,
        weight: params.weight,
        penaltyMultiplier: params.penalty_multiplier,
        templateName: params.template_name || null,
      }
    );

    for (const skillName of params.skills) {
      await this.executeWrite(
        `
          MERGE (s:Skill {name: $skillName})
          WITH s
          MATCH (sc:SkillCategory {category_id: $categoryId})
          MERGE (s)-[:BELONGS_TO]->(sc)
        `,
        { skillName, categoryId }
      );
    }

    return {
      success: true,
      category_id: categoryId,
      skills_assigned: params.skills.length,
    };
  }

  /**
   * Assign skill to existing category
   */
  async assignSkillToCategory(params: {
    skill_name: string;
    category_id: string;
  }): Promise<{
    success: boolean;
  }> {
    await this.executeWrite(
      `
        MERGE (s:Skill {name: $skillName})
        WITH s
        MATCH (sc:SkillCategory {category_id: $categoryId})
        MERGE (s)-[:BELONGS_TO]->(sc)
      `,
      { skillName: params.skill_name, categoryId: params.category_id }
    );

    return { success: true };
  }

  /**
   * Load templates from YAML file
   */
  private loadTemplatesFromYAML(): SkillCategoryTemplatesConfig {
    const yamlPath = path.join(
      __dirname,
      "../database/skill-category-templates.yaml"
    );
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    return YAML.parse(yamlContent) as SkillCategoryTemplatesConfig;
  }

  /**
   * Generate category ID from template and category name
   */
  private generateCategoryId(
    templateName: string,
    categoryName: string,
    domainPrefix?: string
  ): string {
    const normalizedName = categoryName.toLowerCase().replace(/\s+/g, "_");
    if (domainPrefix) {
      return `${domainPrefix}_${templateName}_${normalizedName}`;
    }
    return `${templateName}_${normalizedName}`;
  }
}
