#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync } from "fs";

type Environment = "prod" | "test";
type Operation = "init" | "clean" | "status";

interface DbConfig {
  envFile: string;
  container: string;
  port: string;
}

const getDbConfig = (env: Environment): DbConfig => {
  if (env === "prod") {
    return {
      envFile: ".env.prod",
      container: "neo4j-prod",
      port: process.env.NEO4J_PROD_PORT || "7687",
    };
  } else {
    return {
      envFile: ".env.test",
      container: "neo4j-test",
      port: process.env.NEO4J_TEST_PORT || "7689",
    };
  }
};

const executeCypher = (
  env: Environment,
  operation: Operation,
  query?: string
) => {
  const config = getDbConfig(env);

  // Проверяем существование env файла
  if (!existsSync(config.envFile)) {
    console.error(`❌ Environment file ${config.envFile} not found`);
    process.exit(1);
  }

  // Префиксы команд
  const prodPrefix = `bash -c 'source ${config.envFile} && docker compose --env-file ${config.envFile} exec ${config.container}`;
  const testPrefix = `bash -c 'source ${config.envFile} && docker run --rm --network host`;
  const authFlags = `-u "$NEO4J_USER" -p "$NEO4J_PASSWORD"`;

  let command: string;

  if (env === "prod") {
    // Production: используем docker compose exec
    if (operation === "init") {
      command = `${prodPrefix} cypher-shell ${authFlags} -f /tmp/init.cypher'`;
    } else if (operation === "clean" || operation === "status") {
      command = `${prodPrefix} cypher-shell ${authFlags} -d neo4j "${query}"'`;
    }
  } else if (env === "test") {
    // Test: используем docker run
    if (operation === "init") {
      command = `${testPrefix} -v $(pwd)/database/init.cypher:/tmp/init.cypher neo4j:latest cypher-shell ${authFlags} -a localhost:${config.port} -f /tmp/init.cypher'`;
    } else if (operation === "clean" || operation === "status") {
      command = `${testPrefix} neo4j:latest cypher-shell ${authFlags} -a localhost:${config.port} -d neo4j "${query}"'`;
    }
  }

  console.log(`🔧 Executing ${operation} for ${env} environment...`);
  console.log(
    `📋 Command: ${command.replace(/\$NEO4J_USER/g, "***").replace(/\$NEO4J_PASSWORD/g, "***")}`
  );

  try {
    execSync(command, { stdio: "inherit" });
    console.log(`✅ ${operation} completed successfully for ${env}`);
  } catch (error) {
    console.error(`❌ ${operation} failed for ${env}:`, error);
    process.exit(1);
  }
};

// CLI интерфейс
const [, , env, operation, query] = process.argv;

if (!env || !operation) {
  console.error(`
Usage: npm run db:<env>:<operation>

Environments:
  prod  - Production environment (uses docker compose exec)
  test  - Test environment (uses docker run)

Operations:
  init   - Initialize database with schema
  clean  - Clean all data from database
  status - Show database status

Examples:
  npm run db:prod:init
  npm run db:test:clean
  npm run db:prod:status
`);
  process.exit(1);
}

if (!["prod", "test"].includes(env)) {
  console.error(`❌ Invalid environment: ${env}. Must be 'prod' or 'test'`);
  process.exit(1);
}

if (!["init", "clean", "status"].includes(operation)) {
  console.error(
    `❌ Invalid operation: ${operation}. Must be 'init', 'clean', or 'status'`
  );
  process.exit(1);
}

// Для clean и status нужен query
if (["clean", "status"].includes(operation) && !query) {
  console.error(`❌ Operation '${operation}' requires a query parameter`);
  process.exit(1);
}

executeCypher(env as Environment, operation as Operation, query);
