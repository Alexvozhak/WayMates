import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import neo4j, { Driver } from 'neo4j-driver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SkillCategoryTemplate {
  category_name: string;
  weight: number;
  penalty_multiplier: number;
  skills: string[];
}

interface DomainTemplate {
  description: string;
  categories: SkillCategoryTemplate[];
}

interface TemplatesConfig {
  templates: Record<string, DomainTemplate>;
}

/**
 * Import skill categories from YAML template into Neo4j
 * @param driver Neo4j driver instance
 */
export async function importSkillCategoriesFromYAML(driver: Driver): Promise<void> {
  const yamlPath = path.join(__dirname, 'skill-category-templates.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const data: TemplatesConfig = YAML.parse(yamlContent);

  console.log('Starting skill categories import from YAML...');

  for (const [templateName, template] of Object.entries(data.templates)) {
    console.log(`\nImporting template: ${templateName}`);
    console.log(`Description: ${template.description}`);

    for (const category of template.categories) {
      const categoryId = `${templateName}_${category.category_name.toLowerCase().replace(/\s+/g, '_')}`;

      console.log(`  Creating category: ${category.category_name} (${categoryId})`);

      // Create SkillCategory node
      await driver.executeQuery(`
        MERGE (sc:SkillCategory {category_id: $categoryId})
        SET sc.template_name = $templateName,
            sc.category_name = $categoryName,
            sc.weight = $weight,
            sc.penalty_multiplier = $penaltyMultiplier,
            sc.is_predefined = true,
            sc.created_at = datetime()
      `, {
        categoryId,
        templateName,
        categoryName: category.category_name,
        weight: category.weight,
        penaltyMultiplier: category.penalty_multiplier
      });

      // Assign skills to category
      for (const skillName of category.skills) {
        await driver.executeQuery(`
          MERGE (s:Skill {name: $skillName})
          WITH s
          MATCH (sc:SkillCategory {category_id: $categoryId})
          MERGE (s)-[:BELONGS_TO]->(sc)
        `, { skillName, categoryId });
      }

      console.log(`    Assigned ${category.skills.length} skills`);
    }
  }

  console.log('\n✅ Skill categories import completed!');
}

/**
 * Standalone execution for CLI
 */
async function main() {
  const env = process.env.ENV || 'prod';
  const port = process.env.NEO4J_PORT || '7687';
  const uri = `bolt://localhost:${port}`;
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  console.log(`Connecting to Neo4j (${env}): ${uri}`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    // Test connection
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j');

    // Import categories
    await importSkillCategoriesFromYAML(driver);

  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
