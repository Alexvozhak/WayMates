#!/bin/bash

# Database operations script for WayMates
# Usage: scripts/db.sh <env> <command> [args...]
# Examples:
#   scripts/db.sh test init
#   scripts/db.sh prod clean
#   scripts/db.sh test status

set -e

ENV=$1
shift

if [ -z "$ENV" ]; then
  echo "Usage: scripts/db.sh <env> <command> [args...]"
  echo "  env: prod | test"
  echo "  command: init | clean | status | <cypher-args>"
  exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "test" ]; then
  echo "Error: env must be 'prod' or 'test'"
  exit 1
fi

source ".env.$ENV"

docker compose --env-file ".env.$ENV" exec "neo4j-$ENV" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "localhost:$NEO4J_PORT" "$@"
