# 🚀 Start Planka in 1 Minute

Quick reference for starting Planka kanban board locally.

---

## First Time Setup

```bash
# 1. Config
cp .env.planka.example .env.planka
nano .env.planka  # Change SECRET_KEY and passwords

# 2. Start
docker-compose -f docker-compose.planka.yml --env-file .env.planka up -d

# 3. Open http://localhost:3000
# 4. Login: admin@planka.local / admin123 (or your custom credentials)
# 5. Reload Claude Code window
```

📖 Full guide: [PLANKA-QUICKSTART.md](PLANKA-QUICKSTART.md)

---

## Daily Usage

```bash
# Start Planka
docker-compose -f docker-compose.planka.yml up -d

# Check status
docker-compose -f docker-compose.planka.yml ps

# View logs
docker-compose -f docker-compose.planka.yml logs -f planka

# Stop Planka
docker-compose -f docker-compose.planka.yml down

# Stop + remove data (fresh start)
docker-compose -f docker-compose.planka.yml down -v
```

---

## In Claude Code

```bash
# Natural language task management
"Создай карточку в Planka: оптимизировать поиск"
"Покажи все карточки проекта WayMates"
"Переведи карточку в In Progress"
"Добавь комментарий к карточке: начал работу"
```

---

## URLs

- **Web UI**: http://localhost:3000
- **Default Login**: admin@planka.local / admin123
- **MCP Server**: kanban-mcp (local)
- **Workspace**: Your default workspace

## Ports (host network)

- PostgreSQL: 5434 (not 5432, to avoid conflicts)
- Planka Web: 3000

---

## Comparison with Plane

| Feature | Planka | Plane |
|---------|--------|-------|
| **Services** | 🏆 **2** (planka + postgres) | 6 (api, worker, web, postgres, redis, minio) |
| **Markdown** | ✅ Rich support | ✅ Full support |
| **License** | AGPL-3.0 | AGPL-3.0 |
| **Setup Time** | < 1 min | ~2 min |
| **Memory** | ~200 MB | ~500 MB |
| **Simplicity** | 🏆 **Наш пацан!** | Тяжеловат |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 taken | Change PORT env in docker-compose.planka.yml |
| Database not starting | Check logs: `docker-compose -f docker-compose.planka.yml logs planka-postgres` |
| MCP not working | Update credentials in .mcp.json → Reload Claude Code |
| Can't login | Check DEFAULT_ADMIN_EMAIL/PASSWORD in .env.planka |

Full troubleshooting: [PLANKA-QUICKSTART.md#troubleshooting](PLANKA-QUICKSTART.md#-troubleshooting)

---

**Quick links**:
- [Setup Guide](PLANKA-QUICKSTART.md) - Complete walkthrough
- [kanban-mcp GitHub](https://github.com/bradrisse/kanban-mcp) - MCP server source
- [Planka Docs](https://docs.planka.cloud/) - Official documentation
