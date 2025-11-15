import languagesData from './languages.json' with { type: "json" };
import neo4j, { type Driver } from 'neo4j-driver';

/**
 * Import languages from JSON into Neo4j
 * @param driver Neo4j driver instance
 */
export async function importLanguages(driver: Driver): Promise<void> {
  const languages = Object.entries(languagesData);

  console.log('Starting languages import...');
  console.log(`Found ${languages.length} languages to import\n`);

  for (const [code, name] of languages) {
    console.log(`Importing language: ${code}`);
    console.log(`  Display name: ${name}`);

    await driver.executeQuery(`
      MERGE (l:Language {code: $code})
      SET l.name = $name,
          l.created_at = datetime()
    `, { code, name });
  }

  console.log('\n✅ Languages import completed!');
  console.log(`Total imported: ${languages.length} languages`);
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
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j');

    await importLanguages(driver);

  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
