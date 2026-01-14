# WayMates - AI-Powered Career Transition Platform

[![CI](https://github.com/Alexvozhak/WayMates/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexvozhak/WayMates/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Alexvozhak/WayMates/branch/devel/graph/badge.svg)](https://codecov.io/gh/Alexvozhak/WayMates)

> Production-ready AI application built solo in 6 months

🚀 **Live Bot**: https://t.me/WayMates_bot
📺 **Demo Video**: [10-min walkthrough](https://youtu.be/z9M2QifhEfc)
📺 **Quick Start**: [5-min guide](https://youtu.be/QpgWgkDxJ1A)
📝 **How I Built This**: [LinkedIn Article](https://linkedin.com/in/alexey-komarov-5b0b3b379)

**Status**: ✅ Production (Live on VPS)
**Architecture**: MCP Server + LangGraph + Neo4j
**Stack**: TypeScript, Node.js 24, Neo4j, LangGraph, FastMCP, tRPC

---

## 🎯 What This Demonstrates

This repository showcases a production-ready AI application built solo in 6 months:

### Technical Excellence
- **MCP Server Architecture** - Connect from any MCP client (Claude, Cursor, n8n)
- **Neo4j Graph Database** - Complex Cypher queries for career relationships
- **LangGraph State Machines** - 5 AI agents with checkpoint recovery
- **Multi-language Support** - Auto-translates to user's Telegram locale (EN/RU/ES/etc)
- **Modern Stack** - Node.js 24, TypeScript 5, ESM modules, tRPC

### Engineering Practices
- **284 Integration Tests** - Real LLM calls, parallel execution
- **Security First** - 0 vulnerabilities (semgrep, npm audit)
- **Full DevOps** - CI/CD, Docker orchestration, VPS deployment
- **Clean Code** - Strict ESLint constraints, Husky pre-commit hooks

---

## 📊 Metrics & Achievements

| Metric | Value |
|--------|-------|
| Development Time | 6 months solo |
| Lines of Code | 15,000+ TypeScript |
| Test Coverage | 284 integration tests |
| Security Score | 0 critical/high issues |
| Dependencies | 100% up-to-date (Dependabot) |
| Production Status | ✅ Live 24/7 |
| Docker Services | 6 containers orchestrated |

---

## 🎯 Code Quality Standards

This project enforces strict quality constraints through ESLint:

- **Max nesting depth:** 2 levels
- **Cyclomatic complexity:** <8
- **Function length:** <60 lines
- **TypeScript strict:** No 'any' types
- **No type assertions:** Only type guards/Zod

See my [ESLint config](eslint.config.mjs) for full details.

---

## ⚠️ Installation Note

This repository contains the public components only. The core business logic is in a private submodule that requires access keys.

**To explore the project:**
- Review the public modules architecture
- Examine the strict ESLint configuration
- Check the test structure (284 integration tests)
- Try the live bot: https://t.me/WayMates_bot

For full access, contact: @AlexKomarov1993

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

---

## 📫 Contact

**Developer:** Alexey Komarov
- GitHub: [@Alexvozhak](https://github.com/Alexvozhak)
- Telegram: [@AlexKomarov1993](https://t.me/AlexKomarov1993)
- LinkedIn: [Profile](https://linkedin.com/in/alexey-komarov-5b0b3b379)
- Email: alexvozhak@gmail.com

Looking for founding engineer opportunities where I can ship fast with high quality.
