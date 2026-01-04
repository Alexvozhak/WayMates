# FEAT-036: Repo Split — Подготовка к разделению репозитория

**Статус:** IN_PROGRESS
**Приоритет:** P1
**Зависимости:** ✅ FEAT-032 (Pino), ✅ FEAT-033 (Sentry)
**Блокирует:** Фаза 3 (физический split), Фаза 7 (Deploy)
**Связь:** MVP-RELEASE-PLAN.md → Фаза 3
**Последнее обновление:** 2026-01-04

---

## Принятые решения (2026-01-04)

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| **Shared schemas** | Private npm `@waymates/schemas` на GitHub Packages | Версионирование + single source of truth |
| **Chart module** | Остаётся в waymates-app (public) | Portfolio value, visualization не секретна |
| **Test fixtures** | HTTP `/test/fixtures` API в Core | Чистая архитектура, Core владеет данными |
| **Порядок фаз** | Phase 0 + A параллельно | Fix blockers + Quick wins |

---

## Готовность к Split (анализ 2026-01-04)

| Компонент | Статус | LOC | Notes |
|-----------|--------|-----|-------|
| **Промпты** | ✅ 100% Ready | 1,227 | 10 файлов, чистые функции |
| **Core + Cypher** | ✅ 95% Ready | ~3,140 | Fix REASON_CANONICAL_NAMES import |
| **Facade** | ✅ 90% Ready | ~7,000 | Зависит от core API |
| **Shared schemas** | 🟡 70% Ready | 1,733 | Нужна Tier разбивка |
| **Chart** | 🟡 80% Ready | 1,718 | Убрать chart→facade/env |
| **Telegram-bot** | ✅ 95% Ready | 1,077 | Зависит только от MCP |

### Обнаруженные circular dependencies

| Проблема | Файл | Решение | LOC |
|----------|------|---------|-----|
| Chart → facade/env | `src/chart/services/r2-storage.ts` | Вынести config в shared/env | ~10 |
| AppRouter re-export | `src/shared/types.ts` | Удалить, использовать локально | ~5 |
| REASON_CANONICAL_NAMES | `src/shared/schemas.ts` | Импорт из core, не database/ | ~10 |

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
| `src/prompts/` (новая) | 1,227 | LLM тюнинг, extraction prompts |
| `database/init.cypher` | ~200 | Схема графа, constraints, indexes |

**Итого private:** ~4,567 LOC

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

**Текущая структура (10 файлов, 1,227 LOC):**

| Файл | LOC | Агент/Сервис |
|------|-----|--------------|
| `src/facade/langGraph/cold-start-v2/prompts.ts` | 442 | Cold-Start v2 Graph |
| `src/facade/langGraph/search-graph/prompts/advisor.ts` | 50 | Search Graph |
| `src/facade/langGraph/search-graph/prompts/classification.ts` | 93 | Intent Classification |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | 143 | Data Extraction |
| `src/facade/langGraph/search-graph/prompts/index.ts` | 9 | Re-exports |
| `src/facade/langGraph/upsert-context/prompts.ts` | 47 | Upsert Context |
| `src/facade/langGraph/upsert-trail/prompts.ts` | 29 | Upsert Trail |
| `src/facade/langGraph/update-context/prompts.ts` | 45 | Update Context |
| `src/facade/langGraph/shared/prompts.ts` | 35 | Shared decomposition rules |
| `src/facade/services/nlp-formatter/prompts.ts` | 334 | NLP Formatter |

**Новая структура:**
```
src/prompts/                     ← Все промпты здесь (private)
├── cold-start.ts                # 442 LOC
├── search-graph/
│   ├── advisor.ts               # 50 LOC
│   ├── classification.ts        # 93 LOC
│   ├── extraction.ts            # 143 LOC
│   └── index.ts                 # 9 LOC
├── upsert-context.ts            # 47 LOC
├── upsert-trail.ts              # 29 LOC
├── update-context.ts            # 45 LOC
├── shared.ts                    # 35 LOC
└── nlp-formatter.ts             # 334 LOC
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

## План реализации (обновлён 2026-01-04)

### Phase 0: Fix Dependencies (~2 часа) — ПЕРВЫЙ

| # | Шаг | Файл | LOC |
|---|-----|------|-----|
| 0.1 | Chart config → shared/env | `src/chart/services/r2-storage.ts` | ~10 |
| 0.2 | Удалить AppRouter re-export | `src/shared/types.ts` | ~5 |
| 0.3 | REASON_CANONICAL_NAMES → core | `src/shared/schemas.ts` | ~10 |
| 0.4 | lint + tsc | — | — |

### Phase A: Промпты (~3 часа) — ПАРАЛЛЕЛЬНО с Phase 0

| # | Шаг | LOC | Файлов |
|---|-----|-----|--------|
| A1 | Создать `src/prompts/` директорию | — | 1 |
| A2 | Перенести 10 prompts.ts в `src/prompts/` | 1,227 | 10 |
| A3 | Обновить импорты в facade (~20 файлов) | ~40 | 20 |
| A4 | Создать `src/shared/prompts-contract.ts` | ~100 | 1 |
| A5 | lint + tsc | — | — |

### Phase B: ICoreApi + Test Fixtures (~2 часа)

| # | Шаг | LOC | Файлов |
|---|-----|-----|--------|
| B1 | Создать `shared/core-api-contract.ts` | +80 | 1 |
| B2 | Добавить `/test/fixtures` endpoint в Core | +30 | 1 |
| B3 | Рефакторинг `facade/core-client.ts` | ~70 | 1 |
| B4 | Удалить `shared/types.ts` (уже пустой после Phase 0) | -23 | 1 |
| B5 | lint + tsc + tests | — | — |

### Phase C: @waymates/schemas npm (~1 час)

| # | Шаг | Описание |
|---|-----|----------|
| C1 | Создать `waymates-schemas` repo | Private repo для npm package |
| C2 | Выделить Tier 1 types (enums, IDs, errors) | ~300 LOC |
| C3 | Настроить GitHub Packages | npm publish |
| C4 | Обновить package.json в обеих репах | npm install @waymates/schemas |

### Phase D: Physical Split (~2 часа)

| # | Шаг | Описание |
|---|-----|----------|
| D1 | Создать `waymates-private` repo на GitHub | Private repo |
| D2 | Перенести core/, cypher/, prompts/, database/ | git mv + push |
| D3 | Добавить submodule в waymates-app | git submodule add |
| D4 | Настроить paths в tsconfig.json | Alias @prompts, @core |
| D5 | Добавить LICENSE в public repo | Restrictive license |
| D6 | Обновить README.md | Описание + скриншоты |
| D7 | Проверить что всё работает | npm run build + tests |

---

## Acceptance Criteria

### Phase 0 (Fix Dependencies)
- [ ] Chart не зависит от facade/env
- [ ] shared/types.ts удалён или пустой
- [ ] REASON_CANONICAL_NAMES импортируется локально
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors

### Phase A (Prompts)
- [ ] Все 10 промптов перенесены в `src/prompts/`
- [ ] `IPrompts` interface создан в `shared/prompts-contract.ts`
- [ ] Все импорты обновлены (~20 файлов)
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors

### Phase B (Core API + Fixtures)
- [ ] `ICoreApi` interface создан
- [ ] `/test/fixtures` endpoint работает
- [ ] Facade тесты загружают fixtures через Core API
- [ ] Все тесты проходят

### Phase C (@waymates/schemas)
- [ ] npm package опубликован на GitHub Packages
- [ ] Обе репы используют @waymates/schemas
- [ ] Версионирование работает

### Phase D (Physical Split)
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

- **FEAT-032 (Pino)**: ✅ DONE — logger в shared
- **FEAT-033 (Sentry)**: ✅ DONE — error handling в shared
- **FEAT-031 (Chart Browser Build)**: P2, esbuild компиляция browser JS. Можно делать до или после split
- **Фаза 7 (Deploy)**: После split деплой только public части

---

## Оценка трудозатрат

| Фаза | Время | Сложность | Зависимости |
|------|-------|-----------|-------------|
| 0 (Fix Dependencies) | 2 часа | Низкая | — |
| A (Prompts) | 3 часа | Средняя | Параллельно с Phase 0 |
| B (Core API + Fixtures) | 2 часа | Средняя | После Phase 0 |
| C (@waymates/schemas) | 1 час | Низкая | После Phase B |
| D (Physical Split) | 2 часа | Низкая | После Phase C |
| **Итого** | **8-10 часов** | |
