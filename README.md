# WayMates

> Career transition analysis platform built on Neo4j graph database

**Status**: MVP Development
**Architecture**: Facade (MCP) + Core (REST API)
**Stack**: TypeScript, Node.js, Neo4j, Express, FastMCP

---

## 🚀 Quick Start

См. **[QUICKSTART.md](./QUICKSTART.md)** для полной инструкции по запуску.

### TL;DR

```bash
# 1. Setup
npm install
cp .env.prod.sample .env.prod  # заполнить NEO4J_PASSWORD, OPENAI_API_KEY

# 2. Start infrastructure
docker compose up neo4j-prod redis -d
npm run db:prod:init

# 3. Start Core REST API
tsx src/core/index.ts

# 4. Start Facade MCP Server
tsx src/facade/index.ts
```

---

## 📚 Documentation

### Основные документы:
- **[QUICKSTART.md](./QUICKSTART.md)** - как запустить проект
- **[docs/mvp_final/IMPLEMENTATION_DECISIONS.md](./docs/mvp_final/IMPLEMENTATION_DECISIONS.md)** - архитектурные решения
- **[docs/mvp_final/CHANGELOG_2025_11_03.md](./docs/mvp_final/CHANGELOG_2025_11_03.md)** - последние изменения
- **[CLAUDE.md](./CLAUDE.md)** - инструкции для Claude Code

### Архитектура:
- **[docs/mvp_final/FACADE_NLP_ARCHITECTURE.md](./docs/mvp_final/FACADE_NLP_ARCHITECTURE.md)** - Facade (NLP, LLM)
- **[docs/mvp_final/CORE_SEARCH_ARCHITECTURE.md](./docs/mvp_final/CORE_SEARCH_ARCHITECTURE.md)** - Core (Search, DTW)
- **[docs/architecture/](./docs/architecture/)** - C4 диаграммы

---

## 🏗️ Architecture

```
LibreChat/Cursor → Facade MCP Server → Core REST API → Neo4j
                        ↓                    ↓
                   LLMTranslator        SearchManager
                   AuthService          StoryManager
                   RateLimiter          GoalsManager
                        ↓
                   Redis, SQLite
```

**Компоненты:**
- **Facade** - NLP интерфейс с OpenAI LLM для natural language queries
- **Core** - бизнес-логика поиска карьерных путей через Neo4j
- **Neo4j** - graph database с траекториями пользователей
- **Redis** - rate limiting

---

## 🧪 Testing

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests (Neo4j required)
npm run test:all           # All tests
```

---

## 📁 Project Structure

```
src/
├── core/           # Core REST API (Express)
├── facade/         # Facade MCP Server (FastMCP)
├── shared/         # Shared Zod schemas
└── database/       # Migrations

docs/
├── mvp_final/      # Final architecture docs
└── architecture/   # C4 diagrams

tests/
├── unit/           # Unit tests (no DB)
└── integration/    # Integration tests (Neo4j)
```

---

## 🔧 Development

```bash
npm run lint        # ESLint
npm run lint:fix    # ESLint auto-fix
npx tsc --noEmit    # TypeScript check
```

---

## 📝 License

Private repository - внутренняя разработка WayMates

---

## 🙏 Contributing

См. проектные инструкции в **[CLAUDE.md](./CLAUDE.md)**
