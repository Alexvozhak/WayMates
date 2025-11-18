import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { withNeo4jDriver } from "./import-helpers.js";

import type { Driver } from "neo4j-driver";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

type SkillCategoryTemplate = {
  categoryName: string;
  weight: number;
  penaltyMultiplier: number;
  skills: string[];
};

type DomainTemplate = {
  description: string;
  categories: SkillCategoryTemplate[];
};

type TemplatesConfig = {
  templates: Record<string, DomainTemplate>;
};

export async function importSkillCategoriesFromYAML(driver: Driver): Promise<void> {
  const yamlPath = path.join(dirname, "skill-category-templates.yaml");
  const yamlContent = fs.readFileSync(yamlPath, "utf8");
  const data: TemplatesConfig = YAML.parse(yamlContent);

  console.log("Starting skill categories import from YAML...");

  for (const [templateName, template] of Object.entries(data.templates)) {
    console.log(`\nImporting template: ${templateName}`);
    console.log(`Description: ${template.description}`);

    for (const category of template.categories) {
      await importCategory(driver, templateName, category);
    }
  }

  console.log("\n✅ Skill categories import completed!");
}

async function importCategory(
  driver: Driver,
  templateName: string,
  category: SkillCategoryTemplate,
): Promise<void> {
  const categoryId = `${templateName}_${category.categoryName.toLowerCase().replaceAll(/\s+/g, "_")}`;

  console.log(`  Creating category: ${category.categoryName} (${categoryId})`);

  await driver.executeQuery(
    `
    MERGE (sc:SkillCategory {categoryId: $categoryId})
    SET sc.templateName = $templateName,
        sc.categoryName = $categoryName,
        sc.weight = $weight,
        sc.penaltyMultiplier = $penaltyMultiplier,
        sc.isPredefined = true,
        sc.createdAt = timestamp()
  `,
    {
      categoryId,
      templateName,
      categoryName: category.categoryName,
      weight: category.weight,
      penaltyMultiplier: category.penaltyMultiplier,
    },
  );

  for (const skillName of category.skills) {
    await driver.executeQuery(
      `
      MERGE (s:Skill {canonicalName: $skillName})
      ON CREATE SET s.verified = true,
                    s.createdAt = timestamp(),
                    s.createdBy = "system"
      WITH s
      MATCH (sc:SkillCategory {categoryId: $categoryId})
      MERGE (s)-[:BELONGS_TO]->(sc)
    `,
      { skillName, categoryId },
    );
  }

  console.log(`    Assigned ${category.skills.length} skills`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withNeo4jDriver(importSkillCategoriesFromYAML);
}
