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
      port: "7687",
    };
  } else {
    return {
      envFile: ".env.test",
      container: "neo4j-test",
      port: "7689",
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

  // Общие части команд
  const bashPrefix = `bash -c 'source ${config.envFile} &&`;
  const authFlags = `cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD"`;
  const bashSuffix = `'`;

  let command: string;

  if (env === "prod") {
    // Production: используем docker compose exec
    const composeExec = `docker compose --env-file ${config.envFile} exec ${config.container}`;
    
    if (operation === "init") {
      command = `${bashPrefix} ${composeExec} ${authFlags} -f /tmp/init.cypher${bashSuffix}`;
    } else {
      command = `${bashPrefix} ${composeExec} ${authFlags} -d neo4j "${query}"${bashSuffix}`;
    }
  } else {
    // Test: используем docker run
    const dockerRunBase = `docker run --rm --network host`;
    const image = `neo4j:latest`;
    const addressFlag = `-a localhost:${config.port}`;
    
    if (operation === "init") {
      const volumeMount = `-v $(pwd)/database/init.cypher:/tmp/init.cypher`;
      command = `${bashPrefix} ${dockerRunBase} ${volumeMount} ${image} ${authFlags} ${addressFlag} -f /tmp/init.cypher${bashSuffix}`;
    } else {
      command = `${bashPrefix} ${dockerRunBase} ${image} ${authFlags} ${addressFlag} -d neo4j "${query}"${bashSuffix}`;
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
Usage: tsx scripts/db-ops.ts <env> <operation> [query]

Environments:
  prod  - Production environment (uses docker compose exec)
  test  - Test environment (uses docker run)

Operations:
  init   - Initialize database with schema
  clean  - Clean all data from database
  status - Show database status

Examples:
  tsx scripts/db-ops.ts prod init
  tsx scripts/db-ops.ts test clean "MATCH (n) DETACH DELETE n"
  tsx scripts/db-ops.ts prod status "MATCH (n) RETURN count(n) as total_nodes"
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
