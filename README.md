# WayMates

> Career transition analysis platform built on Neo4j graph database

**Status**: MVP Development
**Architecture**: Facade (MCP) + Core (REST API)
**Stack**: TypeScript, Node.js, Neo4j, Express, FastMCP

---

## 🚀 Quick Start

См. **[QUICKSTART.md](./QUICKSTART.md)** для полной инструкции по запуску.

### First-time clone

⚠️ **Important**: This repo uses Git Submodule for Cypher queries (private repo).

```bash
# Clone with submodules
git clone --recurse-submodules git@github.com:YOUR_USERNAME/waymates.git

# OR if already cloned without submodules:
git submodule update --init --recursive
```

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
├── cypher/         # 🔒 Git Submodule (waymates-cypher-private)
│   ├── index.ts    # Public interface (query builders only)
│   ├── queries/    # Complete Cypher query builders
│   ├── helpers/    # Query building blocks (filters, aggregation, etc.)
│   └── constants/  # Projections, scoring config
└── database/       # Migrations

docs/
├── mvp_final/      # Final architecture docs
└── architecture/   # C4 diagrams + ADRs

tests/
├── unit/           # Unit tests (no DB)
└── integration/    # Integration tests (Neo4j)
```

**Note**: `src/cypher/` is a private Git submodule containing Neo4j Cypher queries and business logic.

---

## 🔧 Development

### Code Quality

```bash
npm run lint        # ESLint
npm run lint:fix    # ESLint auto-fix
npx tsc --noEmit    # TypeScript check
```

### Working with Submodules

```bash
# After git pull (if submodule reference updated)
git pull
git submodule update --init --recursive

# To make changes in src/cypher/
cd src/cypher
git checkout main
# ... make changes ...
git add .
git commit -m "feat: update query"
git push origin main

# Return to main repo and update reference
cd ../..
git add src/cypher
git commit -m "chore: update cypher submodule"
git push
```

---

## 📝 License

Private repository - внутренняя разработка WayMates

---

## 🙏 Contributing

См. проектные инструкции в **[CLAUDE.md](./CLAUDE.md)**
