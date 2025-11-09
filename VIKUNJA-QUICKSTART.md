# Vikunja Quick Start Guide

Modern open-source task management with kanban board, multiple view modes, and Claude Code MCP integration.

---

## 🚀 Deploy Vikunja

### 1. Start containers

```bash
docker compose -f docker-compose.vikunja.yml --env-file .env.vikunja up -d
```

### 2. Open in browser

```
http://localhost:3456
```

**Note**: Uses host network mode for VPN compatibility.

### 3. Register account

1. Click **"Register"**
2. Fill form:
   - Username: `alex`
   - Email: `alex@waymates.dev`
   - Password: choose secure password
3. Login

---

## 🔑 Setup API Token

### 1. Generate token

1. Click avatar (top right) → **Settings**
2. Navigate to **API Tokens**
3. Click **"Create new token"**
4. Name: `Claude Code MCP`
5. Select **all scopes** (full permissions)
6. Click **Create**
7. **Copy token** (format: `tk_...`)

### 2. Add to environment

Edit `.env.vikunja`:
```bash
VIKUNJA_API_TOKEN=tk_your_token_here
```

---

## 🤖 Configure Claude Code MCP

### 1. Locate config file

```bash
~/.config/Claude/claude_desktop_config.json
```

If file doesn't exist, create it.

### 2. Add Vikunja MCP server

```json
{
  "mcpServers": {
    "vikunja": {
      "command": "npx",
      "args": ["-y", "@democratize-technology/vikunja-mcp"],
      "env": {
        "VIKUNJA_URL": "http://localhost:3456/api/v1",
        "VIKUNJA_API_TOKEN": "tk_your_actual_token_here"
      }
    }
  }
}
```

Replace `tk_your_actual_token_here` with your real token.

### 3. Restart Claude Code

Close and reopen Claude Code completely.

---

## ✅ Test Integration

Try these commands in Claude Code:

```
"Create task: Fix TypeScript compilation errors with high priority"

"Show all tasks in todo status"

"Move task #1 to in-progress"

"Mark task #1 as done"
```

Claude will use MCP tools automatically:
- `mcp__vikunja__create_task`
- `mcp__vikunja__list_tasks`
- `mcp__vikunja__update_task`

---

## 🎨 View Modes

Access at http://localhost:3456:

- **Kanban Board** - visual workflow (drag & drop)
- **List View** - simple task list
- **Gantt Chart** - project timeline
- **Table View** - detailed spreadsheet

---

## 🔧 Management Commands

```bash
# View logs
docker compose -f docker-compose.vikunja.yml logs -f

# Stop Vikunja
docker compose -f docker-compose.vikunja.yml down

# Stop and remove data (destructive!)
docker compose -f docker-compose.vikunja.yml down -v

# Restart Vikunja
docker compose -f docker-compose.vikunja.yml restart
```

---

## 📊 Features

- ✅ **Modern UI** - Vue.js 3, responsive, dark mode
- ✅ **Multiple views** - Kanban, List, Gantt, Table
- ✅ **CalDAV/WebDAV** - sync with calendar apps
- ✅ **Task priorities** - 5 priority levels
- ✅ **Labels & tags** - organize tasks
- ✅ **Recurring tasks** - daily, weekly, monthly
- ✅ **Webhooks** - integrate with other services
- ✅ **Lightweight** - 50-100MB RAM usage
- ✅ **Open-source** - AGPLv3 license

---

## 🔗 Resources

- **Documentation**: https://vikunja.io/docs/
- **MCP Server**: https://github.com/democratize-technology/vikunja-mcp
- **API Docs**: http://localhost:3456/api/v1/docs
- **GitHub**: https://github.com/go-vikunja/vikunja

---

## 🆘 Troubleshooting

### Cannot connect to Vikunja

Check containers status:
```bash
docker ps --filter name=vikunja
```

Both should show "Up" status.

### API token not working

1. Verify token in `.env.vikunja`
2. Ensure all scopes selected when creating token
3. Token format must be `tk_...`
4. Restart Claude Code after config change

### MCP server not loading

Check Claude Code logs:
```bash
tail -f ~/.config/Claude/logs/mcp*.log
```

Common issues:
- Wrong token in config
- Network error (check Vikunja is running)
- npx package download failed (check internet)

---

## 💡 Tips

1. **Create project first** - tasks belong to projects
2. **Use labels** - easier filtering and organization
3. **Set due dates** - better time management
4. **Add descriptions** - context for Claude when analyzing tasks
5. **Use priorities** - focus on what matters

---

## 🎯 Next Steps

1. Create your first project
2. Add tasks via Claude Code
3. Explore different view modes
4. Set up recurring tasks
5. Configure webhooks (optional)

Enjoy productive task management! 🚀
