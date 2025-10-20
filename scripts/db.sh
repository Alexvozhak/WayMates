#!/bin/bash

# Execute Cypher queries/files in Neo4j
# Usage: scripts/db.sh <env> <cypher-args>
# Examples:
#   scripts/db.sh test -f /tmp/init.cypher
#   scripts/db.sh prod -d neo4j "MATCH (n) RETURN count(n)"

set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: scripts/db.sh <env> <cypher-args>"
  echo "  env: prod | test"
  echo "  cypher-args: -f <file> | -d <db> <query>"
  exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "test" ]; then
  echo "Error: env must be 'prod' or 'test'"
  exit 1
fi

# Source environment variables
source ".env.$ENV"

# Pass all arguments (except ENV) to cypher-shell
shift
docker compose --env-file ".env.$ENV" exec "neo4j-$ENV" \
  cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
  -a "localhost:$NEO4J_PORT" "$@"
