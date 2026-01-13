# Facade Architecture Refactoring (orchestrator → separate tools)

**Priority**: 🔴 P0

Рефакторить `facade-mcp-server.ts`: удалить orchestrator pattern (единый tool `process`), добавить регистрацию 5 отдельных MCP tools (search_careers, get_story, set_goal, update_context, add_experience).
