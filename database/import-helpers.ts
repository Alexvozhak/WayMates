import neo4j, { type Driver } from "neo4j-driver";

export async function withNeo4jDriver<T>(fn: (driver: Driver) => Promise<T>): Promise<T> {
  const env = process.env.ENV;
  const port = process.env.NEO4J_PORT;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!port || !user || !password) {
    throw new Error(
      "Missing required environment variables: NEO4J_PORT, NEO4J_USER, NEO4J_PASSWORD",
    );
  }

  const uri = `bolt://localhost:${port}`;

  console.log(`Connecting to Neo4j (${env}): ${uri}`);

  const config: neo4j.Config = {
    encrypted: false,
    disableLosslessIntegers: true,
  };

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), config);

  try {
    await driver.verifyAuthentication();
    console.log("✅ Connected to Neo4j");
    return await fn(driver);
  } catch (error) {
    console.error("❌ Error during import:", error);
    throw error;
  } finally {
    await driver.close();
  }
}
