# 🚀 Start Plane in 1 Minute

Quick reference for starting Plane project management locally.

---

## First Time Setup

```bash
# 1. Config
cp .env.plane.example .env.plane
nano .env.plane  # Change SECRET_KEY and passwords

# 2. Start
docker-compose -f docker-compose.plane.yml --env-file .env.plane up -d

# 3. Open http://localhost
# 4. Create account
# 5. Get API key: Settings → API Tokens
# 6. Update .mcp.json with API key
# 7. Reload Claude Code window
```

📖 Full guide: [PLANE-QUICKSTART.md](PLANE-QUICKSTART.md)

---

## Daily Usage

```bash
# Start Plane
docker-compose -f docker-compose.plane.yml up -d

# Check status
docker-compose -f docker-compose.plane.yml ps

# View logs
docker-compose -f docker-compose.plane.yml logs -f plane-api

# Stop Plane
docker-compose -f docker-compose.plane.yml down

# Stop + remove data (fresh start)
docker-compose -f docker-compose.plane.yml down -v
```

---

## In Claude Code

```bash
# Create task with full context
/plane-workflow

# Or natural language
"Создай задачу в Plane: оптимизировать поиск"
"Покажи все задачи проекта CORE"
"Переведи PLN-42 в In Progress"
```

---

## URLs

- **Web UI**: http://localhost:3080
- **API**: http://localhost:8000/api
- **MinIO Console**: http://localhost:9091
- **Workspace**: waymates
- **Project**: WayMates Core (CORE)

## Ports (host network)

- PostgreSQL: 5433 (not 5432)
- Redis: 6380 (not 6379)
- MinIO: 9001/9091 (not 9000/9090)
- Plane API: 8000
- Plane Web: 3080

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 80 taken | Change to 8080 in docker-compose.plane.yml → plane-proxy → ports |
| Slow startup | Wait 1-2 min, check logs: `docker-compose -f docker-compose.plane.yml logs plane-api` |
| API 401 error | Regenerate API key in Settings → API Tokens |
| MCP not working | Update .mcp.json → Reload Claude Code window |

Full troubleshooting: [PLANE-QUICKSTART.md#troubleshooting](PLANE-QUICKSTART.md#-troubleshooting)

---

**Quick links**:
- [Setup Guide](PLANE-QUICKSTART.md) - Complete walkthrough
- [Workflow](/.claude/commands/plane-workflow.md) - Task creation templates
- [Migration](docs/PLANE_MIGRATION.md) - Why Plane vs Vikunja
