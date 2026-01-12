# План: FEAT-036 Repo Split

**Дата:** 2026-01-12
**Статус:** DRAFT
**Цель:** Разделить monorepo на public + private submodule для portfolio презентации

---

## Решения

| Вопрос | Решение |
|--------|---------|
| Public repo | `Alexvozhak/WayMates` |
| Private repo | `Alexvozhak/waymates-core` |
| Codecov | Да, настроить |

---

## Целевая архитектура

```
WayMates/                       # PUBLIC repo (GitHub)
├── src/
│   ├── facade/                 # LangGraph agents, MCP server
│   ├── shared/                 # Schemas, logger, env
│   ├── telegram-bot/           # grammY bot
│   └── chart/                  # Визуализация траекторий
├── private/                    # git submodule → waymates-core
│   ├── core/                   # Бизнес-логика
│   ├── cypher/                 # Neo4j queries
│   ├── prompts/                # LLM промпты (вынести из facade)
│   ├── database/               # Схема, справочники
│   └── tests/                  # ВСЕ тесты
├── .github/
│   ├── workflows/ci.yml        # CI pipeline
│   └── PULL_REQUEST_TEMPLATE.md
├── package.json
├── README.md                   # С badges и архитектурой
└── LICENSE                     # Restrictive (view only)
```

---

## Фазы работ

### Phase 0: Подготовка (~30 мин)

| # | Задача | Файлы |
|---|--------|-------|
| 0.1 | Создать waymates-core repo на GitHub (private) | — |
| 0.2 | Создать SSH ключ для CI | `ssh-keygen -t ed25519` |
| 0.3 | Добавить public key в waymates-core → Deploy Keys | GitHub UI |
| 0.4 | Backup текущего состояния | `git stash` или branch |

### Phase 1: Вынос prompts (~1.5 часа)

**Проблема:** prompts.ts файлы внутри facade — секретные, нужно вынести.

| # | Файл (откуда) | Файл (куда) | LOC |
|---|---------------|-------------|-----|
| 1.1 | `src/facade/langGraph/cold-start-v2/prompts.ts` | `private/prompts/cold-start.ts` | 442 |
| 1.2 | `src/facade/langGraph/search-graph/prompts/*.ts` | `private/prompts/search-graph/` | 295 |
| 1.3 | `src/facade/langGraph/upsert-context/prompts.ts` | `private/prompts/upsert-context.ts` | 47 |
| 1.4 | `src/facade/langGraph/upsert-trail/prompts.ts` | `private/prompts/upsert-trail.ts` | 29 |
| 1.5 | `src/facade/langGraph/update-context/prompts.ts` | `private/prompts/update-context.ts` | 45 |
| 1.6 | `src/facade/langGraph/shared/prompts.ts` | `private/prompts/shared.ts` | 35 |
| 1.7 | `src/facade/services/nlp-formatter/prompts.ts` | `private/prompts/nlp-formatter.ts` | 334 |

**Итого:** ~1227 LOC промптов

**Действия:**
1. Создать `private/prompts/` структуру
2. Переместить файлы (`git mv`)
3. Обновить импорты в facade (~20 файлов)
4. Настроить tsconfig paths: `@prompts/*` → `private/prompts/*`

### Phase 2: Перенос в private (~30 мин)

| # | Что переносим | Откуда | Куда |
|---|---------------|--------|------|
| 2.1 | Core | `src/core/` | `private/core/` |
| 2.2 | Cypher | `src/cypher/` | `private/cypher/` |
| 2.3 | Database | `database/` | `private/database/` |
| 2.4 | Tests | `tests/` | `private/tests/` |

**Действия:**
1. `git mv` для каждой папки
2. Обновить tsconfig paths
3. Обновить импорты в facade/shared

### Phase 3: Исправление зависимостей (~30 мин)

| # | Проблема | Решение |
|---|----------|---------|
| 3.1 | `shared/types.ts` → re-export AppRouter из core | Создать `shared/core-api-contract.ts` с ICoreApi interface |
| 3.2 | `shared/schemas.ts` → import REASON_CANONICAL_NAMES из database | Инлайнить в schemas.ts (~13 значений) |
| 3.3 | `chart/r2-storage.ts` → import config из facade/env | Переместить R2 config в shared/env |

### Phase 4: Настройка submodule (~15 мин)

```bash
# В WayMates repo
cd ~/projects/WayMates

# Инициализировать как новый git repo (или переименовать текущий)
# Добавить private как submodule
git submodule add git@github.com:Alexvozhak/waymates-core.git private

# Commit
git add .gitmodules private
git commit -m "feat: add private submodule"
```

### Phase 5: CI/CD (~1 час)

**Файл:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, devel]
  pull_request:
    branches: [main, devel]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.PRIVATE_REPO_KEY }}
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.PRIVATE_REPO_KEY }}
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    services:
      neo4j:
        image: neo4j:5
        env:
          NEO4J_AUTH: neo4j/testpassword
        ports:
          - 7687:7687
      redis:
        image: redis:7
        ports:
          - 6379:6379
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.PRIVATE_REPO_KEY }}
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
```

**Дополнительно:**
- Branch protection rules (require PR, require checks)
- Dependabot (см. ниже)

### Phase 5.1: Dependabot (~5 мин)

**Файл:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
```

**Что делает:** Автоматически создаёт PR при выходе security updates для зависимостей.

### Phase 6: README + LICENSE (~30 мин)

**README.md:**
- Badges (CI, coverage, TypeScript, Node)
- Описание проекта
- Tech stack
- Архитектурная диаграмма (Mermaid)
- Структура проекта
- Контакт для full access

**LICENSE:**
- Restrictive: view only, no commercial use
- Contact for NDA access

### Phase 7: Верификация (~30 мин)

```bash
# 1. Клонирование с нуля (как работодатель)
cd /tmp
git clone --recurse-submodules git@github.com:Alexvozhak/WayMates.git
cd WayMates
npm ci

# 2. Build
npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Tests (если есть доступ к private)
npm run test:unit
npm run test:integration

# 5. Проверить что prompts НЕ видны в public
ls src/facade/langGraph/cold-start-v2/  # НЕ должно быть prompts.ts
```

---

## Критические файлы для изменения

### Импорты (после выноса prompts)

| Файл | Изменение |
|------|-----------|
| `src/facade/langGraph/cold-start-v2/nodes/*.ts` | `import from "@prompts/cold-start"` |
| `src/facade/langGraph/search-graph/nodes/*.ts` | `import from "@prompts/search-graph"` |
| `src/facade/langGraph/upsert-context/nodes/*.ts` | `import from "@prompts/upsert-context"` |
| `src/facade/langGraph/upsert-trail/nodes/*.ts` | `import from "@prompts/upsert-trail"` |
| `src/facade/langGraph/update-context/nodes/*.ts` | `import from "@prompts/update-context"` |
| `src/facade/services/nlp-formatter/*.ts` | `import from "@prompts/nlp-formatter"` |

### tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@prompts/*": ["./private/prompts/*"],
      "@core/*": ["./private/core/*"],
      "@cypher/*": ["./private/cypher/*"]
    }
  }
}
```

### package.json scripts

```json
{
  "scripts": {
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:all": "vitest run"
  }
}
```

---

## Оценка времени

| Фаза | Время |
|------|-------|
| Phase 0: Подготовка | 30 мин |
| Phase 1: Вынос prompts | 1.5 часа |
| Phase 2: Перенос в private | 30 мин |
| Phase 3: Исправление зависимостей | 30 мин |
| Phase 4: Настройка submodule | 15 мин |
| Phase 5: CI/CD | 1 час |
| Phase 6: README + LICENSE | 30 мин |
| Phase 7: Верификация | 30 мин |
| **Итого** | **~5-6 часов** |

---

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Сломанные импорты после переноса | `npx tsc --noEmit` после каждой фазы |
| CI не видит submodule | Проверить SSH key настройку |
| Тесты падают | Запуск `npm run test:all` после Phase 2 |
| Случайный коммит prompts в public | `.gitignore` + pre-commit hook |

---

## Codecov настройка

1. Зарегистрироваться на [codecov.io](https://codecov.io) через GitHub
2. Добавить WayMates repo в Codecov
3. Скопировать `CODECOV_TOKEN` в GitHub Secrets
4. CI автоматически загружает coverage после тестов

---

## На будущее (post-MVP)

| Сервис | Когда | Зачем |
|--------|-------|-------|
| **OpenSSF Badge** | Перед pre-seed | Серьёзный сигнал для инвесторов |
| **SonarCloud** | Если нужен code quality dashboard | Метрики качества |

---

## Acceptance Criteria

- [ ] Public repo WayMates содержит: facade, shared, telegram-bot, chart
- [ ] Private submodule содержит: core, cypher, prompts, database, tests
- [ ] Prompts НЕ видны в public repo
- [ ] `git clone --recurse-submodules` + `npm ci` + `npm run build` работает
- [ ] CI проходит: lint, typecheck, tests
- [ ] README с badges и архитектурой
- [ ] LICENSE restrictive
