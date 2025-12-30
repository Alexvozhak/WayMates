# FEAT-036: Repo Split — Подготовка к разделению репозитория

**Статус:** TODO
**Приоритет:** P1
**Зависимости:** FEAT-032 (Pino), FEAT-033 (Sentry)
**Блокирует:** Фаза 3 (физический split), Фаза 7 (Deploy)
**Связь:** MVP-RELEASE-PLAN.md → Фаза 3

---

## Бизнес-цели

### 1. Поиск работы (Founding Engineer Web3)
- Public repo как **portfolio piece** для работодателей
- Показать: архитектуру, code quality, tech stack
- НЕ показать: секретную бизнес-логику

### 2. Защита интеллектуальной собственности
- **Cypher запросы** — сложная логика Neo4j, scoring, matching
- **LangGraph промпты** — тюнинг LLM, system prompts, extraction
- **Neo4j схема** — структура графа (database/init.cypher)
- **Бизнес-логика core** — SearchManager, StoryManager, algorithms

### 3. Параллельное развитие
- Возможность развивать WayMates параллельно с работой
- Удобная структура для solo-разработки
- Один git clone для работы, но защищённый public view

---

## Что секретно vs публично

### PRIVATE (waymates-private repo)

| Компонент | LOC | Причина секретности |
|-----------|-----|---------------------|
| `src/core/` | 1,454 | Бизнес-логика, scoring algorithms |
| `src/cypher/` | 1,686 | Neo4j запросы, matching logic |
| `src/prompts/` (новая) | ~1,086 | LLM тюнинг, extraction prompts |
| `database/init.cypher` | ~200 | Схема графа, constraints, indexes |

**Итого private:** ~4,426 LOC

### PUBLIC (waymates-app repo)

| Компонент | LOC | Что показывает |
|-----------|-----|----------------|
| `src/facade/` (без prompts) | ~7,000 | LangGraph структура, MCP tools |
| `src/telegram-bot/` | 1,077 | grammY handlers, UX |
| `src/chart/` | 1,718 | Визуализация |
| `src/shared/` | 1,544 | Zod schemas, types, utils |

**Итого public:** ~11,339 LOC

---

## Архитектура: Git Submodule

```
waymates-app/                    (PUBLIC repo — portfolio)
├── src/
│   ├── shared/                  # Schemas, logger, env, contracts
│   ├── facade/                  # LangGraph agents, MCP server
│   │   └── langGraph/
│   │       └── cold-start-v2/
│   │           ├── nodes/       # ПУБЛИЧНО — структура графа
│   │           ├── state.ts     # ПУБЛИЧНО — типы состояния
│   │           └── index.ts     # Импорт prompts из submodule
│   ├── telegram-bot/            # ПУБЛИЧНО
│   └── chart/                   # ПУБЛИЧНО
├── private/                     ← Git submodule → waymates-private
├── README.md                    # Описание проекта, скриншоты
├── LICENSE                      # Restrictive (см. ниже)
└── docs/
    └── architecture.md          # Диаграммы для работодателей

waymates-private/                (PRIVATE repo — submodule)
├── core/                        # Бизнес-логика
├── cypher/                      # Neo4j запросы
├── prompts/                     # LLM промпты
│   ├── cold-start.ts
│   ├── search-graph.ts
│   ├── upsert-context.ts
│   ├── upsert-trail.ts
│   └── update-context.ts
└── database/
    └── init.cypher              # Схема Neo4j
```

---

## Дизайн решения

### Этап 1: Вынос промптов в отдельную папку

**Текущая структура:**
```
src/facade/langGraph/cold-start-v2/prompts.ts
src/facade/langGraph/update-context/prompts.ts
src/facade/langGraph/upsert-context/prompts.ts
src/facade/langGraph/upsert-trail/prompts.ts
src/facade/langGraph/search-graph/prompts/*.ts
src/facade/services/nlp-formatter/prompts.ts
```

**Новая структура:**
```
src/prompts/                     ← Все промпты здесь (private)
├── cold-start.ts
├── search-graph/
│   ├── extraction.ts
│   ├── clarification.ts
│   └── index.ts
├── upsert-context.ts
├── upsert-trail.ts
├── update-context.ts
└── nlp-formatter.ts
```

**Импорты после рефакторинга:**
```typescript
// До:
import { extractionPrompt } from "./prompts.js";

// После:
import { coldStartPrompts } from "../../../prompts/cold-start.js";
// Или через alias:
import { coldStartPrompts } from "@prompts/cold-start.js";
```

### Этап 2: ICoreApi interface (без изменений)

```typescript
// src/shared/core-api-contract.ts
export interface ICoreApi {
  search: { ... };
  story: { ... };
  context: { ... };
  trail: { ... };
  goal: { ... };
  dictionaries: { ... };
  user: { ... };
}
```

### Этап 3: IPrompts interface

```typescript
// src/shared/prompts-contract.ts
export interface IPrompts {
  coldStart: {
    systemPrompt: string;
    extractionPrompt: (context: string) => string;
    clarificationPrompt: (field: string) => string;
  };
  searchGraph: {
    extractionPrompt: string;
    clarificationPrompt: string;
  };
  // ... остальные
}
```

**Использование в facade:**
```typescript
// src/facade/langGraph/cold-start-v2/nodes/extract.ts
import type { IPrompts } from "../../../shared/prompts-contract.js";

export function createExtractNode(prompts: IPrompts["coldStart"]) {
  return async (state: State) => {
    const result = await llm.invoke(prompts.extractionPrompt(state.context));
    // ...
  };
}
```

### Этап 4: Dependency Injection для prompts

```typescript
// src/facade/bootstrap.ts
import { prompts } from "../private/prompts/index.js"; // Submodule
import { createColdStartGraph } from "./langGraph/cold-start-v2/index.js";

export const coldStartGraph = createColdStartGraph({ prompts: prompts.coldStart });
```

---

## Лицензия для public repo

```markdown
# LICENSE

Copyright (c) 2024-2025 Alexey Komarov

This source code is provided for EDUCATIONAL and PORTFOLIO purposes only.

## You MAY:
- View and study the code structure and architecture
- Reference this project in discussions and interviews
- Use small code snippets (< 50 lines) with attribution

## You MAY NOT:
- Copy substantial portions of this codebase
- Create derivative works based on this code
- Use this code for commercial purposes
- Deploy this code or derivatives as a service
- Remove or modify this license notice

## Full source code:
The complete source code including proprietary components is available
under NDA for potential employers and partners.

Contact: alexvozhak@gmail.com

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

---

## План реализации

### Фаза A: Подготовка промптов (~2-3 часа)

| # | Шаг | LOC | Файлов |
|---|-----|-----|--------|
| A1 | Создать `src/prompts/` директорию | — | 1 |
| A2 | Перенести все prompts.ts в `src/prompts/` | ~1,086 | 10 |
| A3 | Обновить импорты в facade (~20 файлов) | ~40 | 20 |
| A4 | Создать `src/shared/prompts-contract.ts` | ~100 | 1 |
| A5 | lint + tsc | — | — |

### Фаза B: ICoreApi interface (из старого плана, ~2 часа)

| # | Шаг | LOC | Файлов |
|---|-----|-----|--------|
| B1 | Перенести схемы в `shared/schemas.ts` | +20 | 1 |
| B2 | Создать `shared/core-api-contract.ts` | +80 | 1 |
| B3 | Рефакторинг `facade/core-client.ts` | ~70 | 1 |
| B4 | Рефакторинг вызовов в facade | -60 | ~30 |
| B5 | Удалить `shared/types.ts`, `core/schemas.ts` | -23 | 2 |
| B6 | lint + tsc + tests | — | — |

### Фаза C: Физический split (~1-2 часа)

| # | Шаг | Описание |
|---|-----|----------|
| C1 | Создать `waymates-private` repo на GitHub | Private repo |
| C2 | Перенести core/, cypher/, prompts/, database/ | git mv + push |
| C3 | Добавить submodule в waymates-app | git submodule add |
| C4 | Настроить paths в tsconfig.json | Alias @prompts, @core |
| C5 | Добавить LICENSE в public repo | Restrictive license |
| C6 | Обновить README.md | Описание + скриншоты |
| C7 | Проверить что всё работает | npm run build + tests |

---

## Acceptance Criteria

### Фаза A (Prompts)
- [ ] Все промпты перенесены в `src/prompts/`
- [ ] `IPrompts` interface создан в `shared/prompts-contract.ts`
- [ ] Все импорты обновлены
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors

### Фаза B (Core API)
- [ ] `ICoreApi` interface создан
- [ ] `CoreClient` реализует `ICoreApi`
- [ ] Все `.client.xxx.query/mutate()` заменены
- [ ] Старые файлы удалены
- [ ] Все тесты проходят

### Фаза C (Physical Split)
- [ ] `waymates-private` repo создан (private)
- [ ] `waymates-app` repo создан (public)
- [ ] Submodule работает
- [ ] `git clone --recurse-submodules` работает
- [ ] LICENSE добавлен
- [ ] README с описанием и скриншотами
- [ ] Build и tests проходят в обоих repo

---

## Что видит работодатель

После split работодатель видит `waymates-app`:

```
waymates-app/
├── README.md                    # Описание, скриншоты, tech stack
├── LICENSE                      # "Portfolio purposes only"
├── docs/
│   └── architecture.md          # Диаграммы C4, sequence
├── src/
│   ├── shared/                  # Zod schemas, types
│   ├── facade/                  # LangGraph structure, MCP tools
│   ├── telegram-bot/            # grammY handlers
│   └── chart/                   # Visualization
└── private/                     # "This is a git submodule"
    └── README.md                # "Private components, contact for access"
```

**Что показывает:**
- ✅ Архитектура и структура кода
- ✅ TypeScript, Zod, LangGraph использование
- ✅ MCP Server implementation
- ✅ Telegram bot с grammY
- ✅ Code quality (ESLint, types)

**Что НЕ показывает:**
- ❌ Cypher запросы и scoring
- ❌ LLM промпты
- ❌ Neo4j схема
- ❌ Бизнес-логика core

---

## Риски и mitigation

| Риск | Mitigation |
|------|------------|
| Submodule complexity | Документация + скрипт для clone |
| Broken imports | TypeScript path aliases |
| CI/CD для двух repo | GitHub Actions с submodule checkout |
| Работодатель хочет полный код | "Available under NDA" + screen share |

---

## Связь с другими задачами

- **FEAT-032 (Pino)**: Должен быть выполнен до split (logger в shared)
- **FEAT-033 (Sentry)**: Должен быть выполнен до split (error handling)
- **Фаза 7 (Deploy)**: После split деплой только public части

---

## Оценка трудозатрат

| Фаза | Время | Сложность |
|------|-------|-----------|
| A (Prompts) | 2-3 часа | Средняя (много файлов) |
| B (Core API) | 2 часа | Средняя (уже спроектировано) |
| C (Physical Split) | 1-2 часа | Низкая (механическая работа) |
| **Итого** | **5-7 часов** | |
