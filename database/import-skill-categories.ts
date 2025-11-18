import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";
import { z } from "zod";

import { withDriver } from "../src/neo4j.js";

import type { Driver } from "neo4j-driver";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const YAML_FILE = "skill-category-templates.yaml";

const IMPORT_SKILL_CATEGORIES_QUERY = `
  UNWIND $categories AS category
  MERGE (sc:SkillCategory {categoryId: category.categoryId})
  SET sc.templateName = category.templateName,
      sc.categoryName = category.categoryName,
      sc.weight = category.weight,
      sc.penaltyMultiplier = category.penaltyMultiplier,
      sc.isPredefined = true,
      sc.createdAt = timestamp()
  WITH sc, category
  UNWIND category.skills AS skillName
  MERGE (s:Skill {canonicalName: skillName})
  ON CREATE SET s.verified = true,
                s.createdAt = timestamp(),
                s.createdBy = "system"
  WITH s, sc
  MERGE (s)-[:BELONGS_TO]->(sc)
`;

const skillCategoryTemplateSchema = z.object({
  categoryName: z.string().min(1),
  weight: z.number().positive(),
  penaltyMultiplier: z.number().positive(),
  skills: z.array(z.string().min(1)).min(1),
});

const domainTemplateSchema = z.object({
  description: z.string().min(1),
  categories: z.array(skillCategoryTemplateSchema).min(1),
});

const templatesConfigSchema = z.object({
  templates: z.record(z.string(), domainTemplateSchema),
});

async function importSkillCategoriesFromYAML(driver: Driver): Promise<void> {
  const yamlPath = path.join(dirname, YAML_FILE);
  const yamlContent = fs.readFileSync(yamlPath, "utf8");
  const rawData = YAML.parse(yamlContent);
  const data = templatesConfigSchema.parse(rawData);

  console.log("Starting skill categories import from YAML...");

  const categories = Object.entries(data.templates).flatMap(([templateName, template]) => {
    console.log(`\nPreparing template: ${templateName}`);
    console.log(`Description: ${template.description}`);

    return template.categories.map((category) => {
      const categoryId = category.categoryName
        .replaceAll(/[^\s\w]/g, "")
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
      console.log(`  - ${category.categoryName} (${categoryId}, ${category.skills.length} skills)`);

      return {
        categoryId,
        templateName,
        categoryName: category.categoryName,
        weight: category.weight,
        penaltyMultiplier: category.penaltyMultiplier,
        skills: category.skills,
      };
    });
  });

  console.log(`\nImporting ${categories.length} categories...`);
  await driver.executeQuery(IMPORT_SKILL_CATEGORIES_QUERY, { categories });

  console.log("\n✅ Skill categories import completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importSkillCategoriesFromYAML);
}
