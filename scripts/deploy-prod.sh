#!/bin/bash
# Deploy script for VPS production
# Usage: ssh root@72.56.79.252 'bash -s' < scripts/deploy-prod.sh

set -e

cd /opt/waymates

echo "=== Pulling latest code ==="
git pull --recurse-submodules

echo "=== Rebuilding and restarting containers ==="
docker compose --env-file .env.prod --profile prod up --build -d --wait

echo "=== Container status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep prod

echo "=== Deploy complete ==="
