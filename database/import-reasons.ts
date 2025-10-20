import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import neo4j, { Driver } from 'neo4j-driver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ReasonTemplate {
  reason_id: string;
  description: string;
  patterns: string[];
  common_combinations: string[][];
  examples: string[];
}

interface ReasonsConfig {
  reasons: ReasonTemplate[];
}

/**
 * Import context creation reasons from YAML template into Neo4j
 * @param driver Neo4j driver instance
 */
export async function importReasonsFromYAML(driver: Driver): Promise<void> {
  const yamlPath = path.join(__dirname, 'reason-templates.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const data: ReasonsConfig = YAML.parse(yamlContent);

  console.log('Starting reasons import from YAML...');
  console.log(`Found ${data.reasons.length} reasons to import\n`);

  for (const reason of data.reasons) {
    console.log(`Importing reason: ${reason.reason_id}`);
    console.log(`  Description: ${reason.description}`);
    console.log(`  Patterns: ${reason.patterns.length}`);
    console.log(`  Examples: ${reason.examples.length}`);

    // Create Reason node
    // NOTE: We do NOT create relationships to Context nodes
    // The creation_reason property in Context is sufficient for filtering
    await driver.executeQuery(`
      MERGE (r:Reason {reason_id: $reasonId})
      SET r.description = $description,
          r.patterns = $patterns,
          r.common_combinations = $commonCombinations,
          r.examples = $examples,
          r.created_at = datetime(),
          r.created_by = 'predefined_template'
    `, {
      reasonId: reason.reason_id,
      description: reason.description,
      patterns: reason.patterns,
      // Convert array of arrays to string representation for Neo4j
      commonCombinations: reason.common_combinations.map(combo => combo.join(',')),
      examples: reason.examples
    });
  }

  console.log('\n✅ Reasons import completed!');
  console.log(`Total imported: ${data.reasons.length} reasons`);
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

    // Import reasons
    await importReasonsFromYAML(driver);

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
