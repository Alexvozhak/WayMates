# WayMates

[![CI](https://github.com/Alexvozhak/WayMates/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexvozhak/WayMates/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Alexvozhak/WayMates/branch/devel/graph/badge.svg)](https://codecov.io/gh/Alexvozhak/WayMates)

> Career transition analysis platform built on Neo4j graph database

**Status**: MVP Development
**Architecture**: Facade (MCP) + Core (REST API)
**Stack**: TypeScript, Node.js, Neo4j, LangGraph, FastMCP

---

## Overview

WayMates helps users find career paths by matching their current context to target positions through analysis of skills, experience, and transitions of similar professionals.

**Key Features:**
- Natural language interface via Telegram bot
- Career trajectory analysis using graph algorithms
- Skills gap identification and recommendations
- Similar professionals matching (DTW algorithm)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Access to private submodule (waymates-core)

### Clone with submodule

```bash
git clone --recurse-submodules git@github.com:Alexvozhak/WayMates.git
cd WayMates

# If already cloned:
git submodule update --init --recursive
```

### Setup

```bash
npm install
cp .env.example .env.test    # Fill required values
```

### Run (Development)

```bash
# Start infrastructure
npm run test:telegram:setup

# Start Telegram bot (separate terminal)
npm run bot:test
```

---

## 🏗️ Architecture

```
Telegram Bot → Facade MCP Server → Core REST API → Neo4j
     ↓               ↓                   ↓
  grammY        LangGraph           SearchManager
               StateGraph           StoryManager
                   ↓                GoalsManager
            Redis, PostgreSQL
```

**Components:**
- **Telegram Bot** - User interface via grammY
- **Facade** - LangGraph agents for conversation flow
- **Core** - Business logic, search algorithms, Neo4j queries
- **Neo4j** - Graph database with career trajectories

---

## 📁 Project Structure

```
src/
├── facade/         # Facade MCP Server (FastMCP, LangGraph)
├── telegram-bot/   # Telegram bot (grammY)
├── chart/          # Career chart visualization
└── shared/         # Shared utilities

private/            # 🔒 Git Submodule (waymates-core)
├── core/           # Core REST API (Express)
├── cypher/         # Neo4j Cypher query builders
├── database/       # Migrations, reference data
├── prompts/        # LLM prompts
└── tests/          # Integration tests

scripts/            # Shell scripts (db init, imports)
```

---

## 🧪 Testing

```bash
npm run test:unit              # Unit tests
npm run test:integration       # Integration tests (requires Neo4j)
npm run test:all               # All tests
```

---

## 🔧 Development

### Code Quality

```bash
npm run lint:fix    # ESLint auto-fix
npx tsc --noEmit    # TypeScript check
```

### Rebuild Services

```bash
npm run core:rebuild      # After private/core/ changes
npm run facade:rebuild    # After src/facade/ changes
npm run bot:docker:restart # After src/telegram-bot/ changes
```

### Working with Submodule

```bash
# Update submodule after git pull
git submodule update --init --recursive

# Make changes in private/
cd private
git checkout devel
# ... make changes ...
git add . && git commit -m "feat: update"
git push origin devel

# Update reference in main repo
cd ..
git add private
git commit -m "chore: update private submodule"
```

---

## 📝 License

Copyright (c) 2024-2026 Alexvozhak. All Rights Reserved.

See [LICENSE](./LICENSE) for details.
