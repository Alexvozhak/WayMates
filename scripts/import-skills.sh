#!/bin/bash

# Import skills with complexity from YAML into Neo4j
# Usage: scripts/import-skills.sh <env>
# Migrated to complexity-based scoring (ADR-009)

set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: scripts/import-skills.sh <env>"
  echo "  env: prod | test"
  exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "test" ]; then
  echo "Error: env must be 'prod' or 'test'"
  exit 1
fi

# Source environment variables
source ".env.$ENV"
export ENV NEO4J_URI NEO4J_USER NEO4J_PASSWORD

# Run import
npx tsx database/import-skills.ts
