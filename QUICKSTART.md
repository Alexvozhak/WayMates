# WayMates - Quick Start Guide

**Дата обновления**: 2025-11-03
**Архитектура**: Facade (MCP) + Core (REST API)

---

## 🏗️ Архитектура

```
LibreChat/Cursor
    ↓ [MCP protocol - stdio]
Facade MCP Server (FastMCP)
    ├─ FacadeOrchestrator
    │   ├─ AuthService (SQLite)
    │   ├─ RateLimiter (Redis)
    │   └─ LLMTranslator (OpenAI)
    ↓ [REST API - axios]
Core REST Server (Express :9000)
    ├─ SearchManager
    ├─ StoryManager
    └─ GoalsManager
        ↓
    Neo4j Graph Database
```

---

## 📋 Компоненты

| Компонент | Технология | Порт | Назначение |
|-----------|-----------|------|-----------|
| **Facade MCP** | Node.js + FastMCP | stdio | NLP интерфейс, LLM translation |
| **Core REST** | Node.js + Express | 9000 | Бизнес-логика, Neo4j queries |
| **Neo4j** | Neo4j 5.15 + GDS | 7687 | Graph database |
| **Redis** | Redis 7 | 6379 | Rate limiting |

---

## 🚀 Запуск (локально)

### 1. Предварительные требования

```bash
# Node.js 20+
node --version

# Docker для Neo4j и Redis
docker --version
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка окружения

```bash
# Скопировать .env файлы
cp .env.prod.sample .env.prod
cp .env.test.sample .env.test

# Отредактировать .env.prod:
# - NEO4J_PASSWORD=your_password
# - OPENAI_API_KEY=sk-...
```

**Обязательные переменные в .env.prod:**
```bash
# Neo4j
NEO4J_PASSWORD=your_password_here
NEO4J_PORT=7687

# Core REST API
CORE_PORT=9000
CORE_HOST=0.0.0.0
CORE_API_URL=http://localhost:9000/api

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (для LLM Translator)
OPENAI_API_KEY=sk-...
```

### 4. Запустить инфраструктуру

```bash
# Запустить Neo4j и Redis
docker compose up neo4j-prod redis -d

# Дождаться готовности Neo4j (healthcheck)
docker compose ps

# Инициализировать БД (создать индексы, импорт данных)
npm run db:prod:init
```

### 5. Запустить Core REST API

```bash
# В терминале 1
tsx src/core/index.ts

# Проверить health:
# curl http://localhost:9000/health
```

### 6. Запустить Facade MCP Server

```bash
# В терминале 2
tsx src/facade/index.ts

# Facade подключится к Core и будет готов принимать MCP запросы
```

---

## 🧪 Разработка

### Запуск тестов

```bash
# Unit тесты (без БД)
npm run test:unit

# Integration тесты (с Neo4j test)
npm run test:integration

# Все тесты
npm run test:all
```

### Lint и TypeScript

```bash
# ESLint
npm run lint

# TypeScript check
npx tsc --noEmit
```

### Cypher queries rebuild

```bash
# После изменения query builders
npm run build:cypher
```

---

## 📁 Структура проекта

```
src/
├── core/                       # Core REST API
│   ├── index.ts               # Entry point (Express server)
│   ├── rest-server.ts         # REST routes + middleware
│   ├── search-manager.ts      # SearchManager (бизнес-логика)
│   ├── story-manager.ts       # StoryManager (CRUD contexts)
│   └── goals-manager.ts       # GoalsManager (CRUD goals)
│
├── facade/                     # Facade MCP Server
│   ├── index.ts               # Entry point (FastMCP)
│   ├── facade-mcp-server.ts   # MCP tool registration
│   ├── facade-orchestrator.ts # Orchestration (Auth → LLM → Core)
│   ├── auth-service.ts        # SQLite auth
│   ├── rate-limiter.ts        # Redis rate limiting
│   ├── llm-translator.ts      # OpenAI NLP translation
│   └── mappers/               # LLM param mappers
│
├── shared/                     # Shared schemas
│   └── schemas.ts             # Zod schemas (UserContext, Goal, etc.)
│
└── database/                   # DB migrations
    └── migrations/
        └── 001_users_table.ts
```

---

## 🐳 Запуск в Docker (опционально)

### Раскомментировать сервисы в docker-compose.yml:

```yaml
services:
  core:
    # Раскомментировать этот блок
    build: .
    command: tsx src/core/index.ts
    env_file: .env.prod
    network_mode: host
    depends_on:
      neo4j-prod:
        condition: service_healthy

  facade:
    # Раскомментировать этот блок
    build: .
    command: tsx src/facade/index.ts
    env_file: .env.prod
    network_mode: host
    depends_on:
      redis:
        condition: service_healthy
```

### Запустить всё:

```bash
docker compose --profile app up -d
```

---

## 📚 Документация

### Основные документы (актуальные):

- **docs/mvp_final/IMPLEMENTATION_DECISIONS.md** - архитектурные решения (REST API, FacadeOrchestrator)
- **docs/mvp_final/FACADE_NLP_ARCHITECTURE.md** - архитектура Facade (NLP, LLM, Auth)
- **docs/mvp_final/CORE_SEARCH_ARCHITECTURE.md** - архитектура Core (Search, DTW, Goals)
- **docs/mvp_final/ARCHITECTURE_CHECKLIST.md** - статус готовности компонентов

### Архитектурные диаграммы:

- **docs/architecture/workspace.dsl** - Structurizr C4 model
- **docs/architecture/diagrams/mvp-classes.mmd** - UML class diagram

---

## 🔧 Troubleshooting

### Core не стартует

```bash
# Проверить Neo4j
docker compose logs neo4j-prod

# Проверить health
curl http://localhost:7474
```

### Facade не подключается к Core

```bash
# Проверить CORE_API_URL
echo $CORE_API_URL

# Должно быть: http://localhost:9000/api

# Проверить Core работает
curl http://localhost:9000/health
```

### Redis connection failed

```bash
# Проверить Redis
docker compose ps redis
docker compose logs redis

# Restart Redis
docker compose restart redis
```

---

## ⚙️ Конфигурация

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORE_PORT` | 9000 | Core REST API port |
| `CORE_HOST` | 0.0.0.0 | Core bind address |
| `CORE_API_URL` | http://localhost:9000/api | Core API URL (for Facade) |
| `NEO4J_PORT` | 7687 | Neo4j bolt port |
| `NEO4J_PASSWORD` | - | Neo4j password (required) |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `OPENAI_API_KEY` | - | OpenAI API key (required) |

---

## 📝 Commits & Changelog

См. `git log` для истории изменений.

**Последние обновления (2025-11-03):**
- ✅ Рефакторинг архитектуры: MCP → REST для Core
- ✅ Создан FacadeOrchestrator (разделение ответственностей)
- ✅ Удален CoreClient (прямое использование axios)
- ✅ Обновлена документация

---

**Готово к разработке!** 🎉
