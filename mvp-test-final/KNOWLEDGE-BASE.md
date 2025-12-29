# WayMates Manual Testing Knowledge Base

> Единый документ для быстрого входа в контекст отладки. Без снипетов кода — только знания.

---

## 1. О ПРОЕКТЕ

**WayMates** — платформа анализа карьерных переходов на Neo4j. Помогает найти людей с похожим карьерным путём или тех, кто уже достиг желаемой позиции.

### Архитектура (3 слоя)

| Слой             | Порт | Роль                                 |
| ---------------- | ---- | ------------------------------------ |
| **Core** (tRPC)  | 9000 | Бизнес-логика, Cypher queries, Neo4j |
| **Facade** (MCP) | 3001 | LangGraph агенты, NLP, LLM           |
| **Telegram Bot** | -    | grammY бот → вызывает Facade MCP     |

### Ключевые понятия

> Бизнес-смысл сущностей → см. [BUSINESS-LOGIC-MVP.md](./BUSINESS-LOGIC-MVP.md#1-концепция-продукта)

**Технические детали:**

| Термин | Техническая роль |
|--------|------------------|
| **Context** | Node в Neo4j, содержит `position`, `role`, `domains[]`, `skills[]` |
| **Trajectory** | Цепочка Context связанных `PREVIOUS_CONTEXT` |
| **Adhoc Context** | Временный объект (не node в Neo4j), не сохраняется |

### Допустимые состояния User

| Flow       | User node  | Contexts | Goal       |
| ---------- | ---------- | -------- | ---------- |
| Cold-start | ✅         | ✅ 1+    | может быть |
| Adhoc      | может быть | ❌ 0     | может быть |

**User без Context** — валидное состояние для adhoc-пользователей.

---

## 2. СТРУКТУРА ПРОЕКТА

```
src/
├── core/                  # tRPC API — бизнес-логика
│   ├── search-manager.ts  # Поиск (adhoc, byUser, byTarget)
│   ├── goals-manager.ts   # CRUD целей
│   ├── story-manager.ts   # Сохранение историй
│   └── routers/           # tRPC роутеры
│
├── facade/                # MCP сервер + LangGraph
│   ├── langGraph/
│   │   ├── search-graph/  # Граф поиска (основной flow)
│   │   │   ├── nodes/     # load-context, show-*, extract-*, ask-adhoc-context
│   │   │   ├── prompts.ts # extraction prompts (adhoc, goal, advisor)
│   │   │   ├── state.ts   # SearchStateType, PHASE, NODE
│   │   │   └── search-router.ts # routing логика
│   │   ├── cold-start-v2/ # Сбор карьерной истории
│   │   └── shared/        # with-logging, types
│   ├── services/
│   │   ├── orchestrator/  # flow-guard-checker, graph-manager, intent-classifier
│   │   └── nlp-formatter/ # NlpFormatter + GRAPH_PROMPTS (форматирование ответов)
│   └── mcp-server/tools/  # MCP tools (converse, search, goal)
│
├── telegram-bot/          # Telegram интеграция
│   ├── handlers/          # /start, converse
│   ├── presenters/        # SystemMessagePresenter, base-presenter (LLM перевод)
│   └── services/          # MCP client, session
│
├── cypher/                # Query builders
│   ├── queries/           # search.ts, paths.ts, goals.ts
│   └── helpers/           # filters, aggregation
│
└── shared/                # Общие утилиты
    ├── schemas.ts         # Zod типы
    └── logger.ts          # Pino логгер
```

### Архитектура зависимостей

```
           shared
          /      \
     facade      telegram-bot
```

- `shared` = контракт между пакетами
- facade и telegram-bot НЕ зависят друг от друга
- ConverseResponse, SearchGraphResponse — в shared

### Где искать

| Что ищу                     | Где смотреть                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| Поиск кандидатов            | `src/core/search-manager.ts`                                     |
| Cypher queries              | `src/cypher/queries/search.ts`                                   |
| SearchGraph nodes           | `src/facade/langGraph/search-graph/nodes/`                       |
| Extraction prompts          | `src/facade/langGraph/search-graph/prompts/extraction.ts`        |
| Classification prompts      | `src/facade/langGraph/search-graph/prompts/classification.ts`    |
| Advisor prompts             | `src/facade/langGraph/search-graph/prompts/advisor.ts`           |
| Routing логика              | `src/facade/langGraph/search-graph/search-router.ts`             |
| State и фазы                | `src/facade/langGraph/search-graph/state.ts`                     |
| Intent classification       | `src/facade/services/orchestrator/intent-classifier.ts`          |
| Flow guards (help, unknown) | `src/facade/services/orchestrator/flow-guard-checker.service.ts` |
| NLP форматирование          | `src/facade/services/nlp-formatter/prompts.ts`                   |
| Telegram handlers           | `src/facade/mcp-server/tools/converse.tool.ts`                   |
| LLM перевод сообщений       | `src/telegram-bot/presenters/system-message-presenter.ts`        |
| Zod схемы                   | `src/shared/schemas.ts`                                          |

---

## 3. ИНФРАСТРУКТУРА

### Docker сервисы (test profile)

| Сервис     | Контейнер              | Порт |
| ---------- | ---------------------- | ---- |
| Neo4j      | waymates-neo4j-test    | 7689 |
| PostgreSQL | waymates-postgres-test | 5433 |
| Redis      | waymates-redis-test    | 6380 |
| Core API   | waymates-core-test     | 9000 |
| Facade MCP | waymates-facade-test   | 3001 |

### Команды запуска

```bash
# Поднять всю инфраструктуру
npm run test:telegram:setup

# Загрузить Kaggle данные (225 пользователей)
set -a && source .env.test && set +a && npx tsx scripts/import-kaggle.ts

# Запустить бота
npm run bot:test

# Логи
docker logs waymates-facade-test -f
docker logs waymates-core-test -f
```

### Hot Reload (после изменений в facade)

```bash
# 1. Пересобрать facade + сбросить checkpoints
npm run facade:rebuild

# 2. Перезапустить бота (MCP сессия теряется!)
npm run bot:kill && npm run bot:test
```

### Хранилища данных

| Что                   | Где                          | Сброс                                                                                     |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| LangGraph checkpoints | **Postgres** (facade schema) | `TRUNCATE facade.checkpoints, facade.checkpoint_writes, facade.checkpoint_blobs CASCADE;` |
| MCP сессии            | **Redis**                    | Теряются при пересборке facade                                                            |
| User/Context/Goal     | **Neo4j**                    | Через Cypher DELETE                                                                       |

**ВАЖНО**: После пересборки facade бот теряет MCP сессию — нужен перезапуск бота.

### Проверка здоровья

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep waymates
```

---

## 4. ЛОГИРОВАНИЕ

### Pino (структурные логи)

- **Все сервисы** используют Pino
- **Объекты сжимаются** в логах до `"{...}"` (with-logging.ts summarizeState)
- **Sensitive data**: автоматически redact (password, token, apiKey)

| Компонент | Команда                               |
| --------- | ------------------------------------- |
| Facade    | `docker logs waymates-facade-test -f` |
| Core      | `docker logs waymates-core-test -f`   |
| Bot       | `/tmp/bot.log` или терминал           |

### Как добавить временные логи

```typescript
// Facade — import из локального logger.js
import { logger } from "../../../logger.js"; // путь относительно файла

// Формат Pino: объект первый, сообщение второй
logger.info({ extracted, userResponse }, "adhoc extraction result");
logger.warn({ error }, "something went wrong");

// НЕ console.log — не попадёт в docker logs!
```

**После отладки**: удалить временные логи, они не нужны в проде.

### LangSmith (трассировка LLM)

| Переменная        | Значение             |
| ----------------- | -------------------- |
| LANGSMITH_TRACING | true                 |
| LANGSMITH_PROJECT | waymates-manual-test |

**Программный query**: через `langsmith` SDK, см. `docs/architecture/decisions/ADR-018-langsmith-observability.md`

### Adhoc vs Cold-Start Normalization

| Контекст | Поведение normalizer | Причина |
|----------|---------------------|---------|
| **cold-start** | `normalizeTerm` — добавляет новые термины в словарь | Пользователь создаёт профиль |
| **adhoc** | `filterToKnown` — фильтрует к известным | Пользователь только ищет |

**Методы в Normalizer:**
- `normalizeFullContext` — для cold-start (добавляет термины)
- `normalizeAdhocContext` — для adhoc (только фильтрация)
- `filterToKnown`, `filterArrayToKnown` — private helpers для adhoc

### Dictionary Hints Pollution

LLM extraction получает hints из `getVerifiedDictionaries()` — все `verified: true` entries.

**Проблема**: Если тест создаёт entry с `verified: true`, он попадает в hints и ломает extraction.

**Симптом**: LLM возвращает `test-position-12345` вместо `junior`.

**Решение**:
1. Тесты используют `verified: false` для user-suggested terms
2. Или cleanup entries в afterAll
3. Или отдельная test DB

---

## 5. SEARCHGRAPH FLOW (Основной сценарий)

### Поток startAdhoc

```
User: "Давай быстрый поиск" / "Я backend разработчик"
    ↓
Intent: startAdhoc
    ↓
load_context → extraction adhocContext
    ↓ [routeAfterLoadContext]
    ├─ adhocContext INVALID → ask_adhoc_context (interrupt: "кто ты?")
    └─ adhocContext VALID → confirm_adhoc_context (interrupt: "что дальше?")
        ↓
    User выбирает:
        ├─ "Глянуть похожих" → explore → show_exploration
        ├─ "У меня есть цель" → extract_goal → show_goal
        └─ "Ищем к цели" (если goal есть) → search → show_results
```

### Поток startWithProfile (пользователь с профилем)

```
User: "Поиск"
    ↓
Intent: startWithProfile
    ↓
load_context (из БД) → check_goal
    ├─ goal есть → load_existing_goal → search
    └─ goal нет → explore → show_exploration
```

### Ключевые фазы

| Фаза                                 | Что происходит                                |
| ------------------------------------ | --------------------------------------------- |
| `asking_adhoc_context`               | Просим контекст (нет данных для поиска)       |
| `confirming_adhoc_context`           | Подтверждаем контекст, спрашиваем что дальше  |
| `showing_exploration_candidates`     | Показываем кандидатов без goal (< threshold)  |
| `showing_exploration_facets`         | Показываем facets без goal (>= threshold)     |
| `showing_goal`                       | Показываем извлечённую цель для подтверждения |
| `asking_after_validate_candidates`   | Показываем pathfinders (< threshold)          |
| `asking_after_validate_facets`       | Показываем facets pathfinders (>= threshold)  |
| `asking_search_mode`                 | Выбор режима: pathfinders или waymates        |
| `showing_results`                    | Финальные результаты с pathfinder/waymate     |

**PHASE = response schema** — определяет структуру ответа (discriminatedUnion).
**NODE = execution unit** — определяет бизнес-логику.

### Валидация adhocContext

**Required поля** (ADHOC_REQUIRED_FIELDS):
- position (junior, senior)
- role (backend, frontend)
- countryCode
- domains[] (1+ элемент)

**Optional поля** (ADHOC_OPTIONAL_FIELDS):
- skills, industry, companySize, cityName, citizenships, birthYear, educationLevel, languages

**Flow валидации:** `adhocContextBase (nullable)` → LLM extraction → `adhocContextRequiredSchema (.omit().extend())` → Zod safeParse → `missingFields[]`

**Schema derivation:**
```
✅ schema.omit({...}).extend({...})  — наследование с заменой required
❌ дублировать поля в новой схеме   — рассинхрон
```

**LLM Merge:** Неполный контекст → `ask_adhoc_context` → `clarifyAdhocContext` (LLM merge старое + новое).

---

## 6. LANGGRAPH — КРИТИЧЕСКИЕ ПРАВИЛА

### Два уровня Intent Classification

```
User Message
    ↓
┌─────────────────────────────────────────────────┐
│ ORCHESTRATOR (ConverseTool)                      │
│ classifyIntent(message) → UserIntent             │
│ Решает: какой граф запустить или guard           │
│ Intents: startAdhoc, help, greeting, search...   │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ GRAPH-INTERNAL (parse_search_intent)             │
│ parseUserIntent(message, phase) → SearchIntent   │
│ Решает: куда роутить ВНУТРИ графа                │
│ Intents: proceed, clarify, validate, save...     │
│ phase передаётся для контекста (PHASE_CONTEXT)   │
└─────────────────────────────────────────────────┘
```

**Критично**: При resume активного графа orchestrator intent ИГНОРИРУЕТСЯ!
Граф использует свой parseUserIntent с phase context.

**Orchestrator priority rules** (intent-classifier.ts):
1. Greeting + substantive content → prioritize substantive (startAdhoc, search)
2. `greeting` = ТОЛЬКО чистое приветствие без контента
3. Unclear/garbage → `unknown`

### Типы нод

| Тип                               | Задача                       | Делает                                     | НЕ делает               |
| --------------------------------- | ---------------------------- | ------------------------------------------ | ----------------------- |
| **INTERRUPT** (show\_\*)          | Показать данные, ждать ответ | interrupt(), return userResponse           | routing, бизнес-логика  |
| **PARSE** (parse\_\*)             | Распознать intent            | parseUserIntent(), return searchUserIntent | interrupt, routing      |
| **BUSINESS** (extract*\*, set*\*) | Одна операция                | LLM/DB call, return data                   | interrupt, multiple ops |

### Gotchas

1. **checkpointer обязателен** для interrupt
2. **thread_id обязателен** для persistence
3. **userResponse очищать в business-ноде** после использования (`userResponse: ""`). Не в parse_search_intent — он только классифицирует
4. **buildRouteMap** должен содержать ВСЕ возможные return values роутера
5. **unknown intent → safe fallback**, не infinite loop
6. **Optional Zod field**: undefined (отсутствие), НЕ null
7. **LLM merge pattern** для incremental input — передавать текущее состояние в промпт
8. **Structured output gotcha**: LLM возвращает `""` вместо `null` — фильтровать в extraction functions
9. **Business-нода отвечает за cleanup** — кто использует данные, тот и очищает. Паттерн cold-start/upsert-context/search-graph
10. **Reasoning в structured output** — добавляем `reasoning: z.string()` в schema, LLM вынужден объяснить решение перед ответом. Улучшает следование инструкциям и помогает отладке

### Two-Node Pattern

Когда нужно сгенерировать + показать:

```
generate_* (бизнес → state) → show_* (interrupt)
```

Потому что interrupt() прерывает — return не достигается.

### Data Flow: interrupt → response-builder → NLP

```
Нода: interrupt({phase, ...data})     ← сохраняется в snapshot
          ↓
Graph: extractInterruptPhase(snapshot) ← извлекает только phase
          ↓
Graph: responseBuilders[phase](state)  ← формирует response из state
          ↓
NLP: format(response)                  ← генерирует текст
```

**Важно:** interrupt.message НЕ используется! Текст формируется в response-builder или NLP.

**Паттерн search-graph:** response-builders возвращают ДАННЫЕ, NLP генерирует текст.

---

## 7. CYPHER — КРИТИЧЕСКИЕ ПРАВИЛА

### Map Projection

```
✅ RETURN node { .property1, .property2, computed: other.field }
❌ RETURN { property: node.property }
```

### WITH Scope

```
✅ MATCH (u) WITH u, u.id AS uid RETURN u.name
❌ MATCH (u) WITH u.id AS uid RETURN u.name  [u undefined!]
```

### Null Safety

```
✅ WHERE ANY(x IN coalesce($array, []) WHERE ...)
❌ WHERE ANY(x IN $array WHERE ...)  [error if null]
```

### Naming (Canonical Pattern)

| Контекст             | Переменная             |
| -------------------- | ---------------------- |
| Кто ищет             | `searchingContext`     |
| Кого нашли           | `matchedContext`       |
| Траектория user'а    | `searchingPathContext` |
| Траектория кандидата | `matchedPathContext`   |

---

## 8. WORKFLOW ОТЛАДКИ

### 1. Проблема в боте

```bash
# Логи facade
docker logs waymates-facade-test -f

# Что смотреть:
# - phase после каждой ноды
# - adhocContext после extraction
# - routing decisions
```

### 2. Проблема в поиске (0 результатов)

```bash
# Проверить данные в БД
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User) RETURN count(u)"
})

# Проверить что ищем
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User)-[:HAS_CONTEXT]->(c) RETURN u.userId, c.position LIMIT 5"
})
```

### 3. Routing баг

1. Добавить временный console.log в ноду
2. Запустить тест: `npx vitest path/to/test.ts -t "TC-X" --run`
3. Проверить: все cases покрыты? buildRouteMap содержит все destinations?
4. Удалить debug logging после фикса

### 4. LLM extraction проблема

- Проверить hints (словари инжектируются?)
- Проверить что schema использует enum (не string)
- Проверить что nullable для OpenAI (не optional)

---

## 9. КАЧЕСТВО КОДА

### Обязательные проверки (только tsc)

```bash
npx tsc --noEmit
```

### Не запускать lint во время отладки

Lint можно пропустить — фокус на функциональности.

### Консистентность

Смотри `.claude/context/guidelines.md` для паттернов кода.

---

## 10. INTENT ARCHITECTURE

> Бизнес-семантика intent'ов → см. [BUSINESS-LOGIC-MVP.md](./BUSINESS-LOGIC-MVP.md#intent-семантика)

### Single Source of Truth

Intent'ы определены в `state.ts` как const arrays:
- `SIMPLE_INTENTS` — без доп. полей (proceed, explore, save, change, delete, cancel, unknown)
- `COMPLEX_INTENTS` — с clarificationText/filters/question (validate, clarify, filter, ask)

**Где используются (обновить при добавлении):**

| Файл | Что обновить |
|------|--------------|
| `state.ts` | SIMPLE_INTENTS / COMPLEX_INTENTS arrays |
| `classification.ts` | INTENT_DESCRIPTIONS record |
| `search-router.ts` | createIntentRoutes() |

**ВАЖНО:** Prompt строится динамически из router — показывает ТОЛЬКО valid intents для фазы.

---

## 10.1 CHART ARCHITECTURE

| Нода | Chart Mode | Условие |
|------|------------|---------|
| `show_results` | `full` | userTrajectory.length > 0 |
| `validate_goal` | `goal-only` | candidates.length > 0 |
| `explore` | `full` / `candidates-only` | userTrajectory или adhocContext |

**3 режима (discriminated union):**
- `full` — user trajectory + candidates
- `candidates-only` — adhoc marker + candidates
- `goal-only` — candidates + Goal Line

**Ключевые файлы:**
- Types: `src/chart/types.ts`
- Transformer: `src/chart/services/trajectory-transformer.ts`
- Builder: `src/chart/builders/chart-builder.ts`

---

## 11. SEARCH ARCHITECTURE (Core)

> Бизнес-логика поиска (что каждый режим означает) → см. [BUSINESS-LOGIC-MVP.md](./BUSINESS-LOGIC-MVP.md#5-логика-поиска)

### Unified Flow

```
Cypher (Light query, без path/trails)
    ↓
PathCollectorService.collectTrajectories(candidateIds)
    ↓
DTW enrichment (если userTrajectory >= 3)
    ↓
Sort (dtwTotal + contextMatchScore) → slice(pathLimit)
```

### Type Hierarchy

```
candidateBaseSchema (path/trails required):
├── matchedContext, timeSinceMatchedMonths, contextMatchScore
├── path, trails, dtwMetrics?, dtwTotal?

WaymateCandidate = base + isWaymate
PathfinderCandidate = base + targetContext + timeSinceTargetMonths
```

**Light типы (Cypher parsing):** `*CandidateLight` — без path/trails.

### Ключевые файлы

| Компонент | Файл |
|-----------|------|
| Cypher queries | `src/cypher/queries/search.ts` |
| Scoring helper | `src/cypher/helpers/scoring.ts` |
| SearchManager | `src/core/search-manager.ts` |
| PathCollector | `src/core/path-collector.service.ts` |
| TrajectorySimilarity | `src/core/trajectory-similarity.service.ts` |
| Types | `src/shared/schemas.ts` |

### Skills Scoring

```
referenceContext.skills ∩ candidateSkills → positive
candidateSkills \ referenceContext.skills → penalty
contextMatchScore = max(0, positive - penalty)
```

### DTW Architecture

DTW вычисляется **в TypeScript**, не в Cypher.

**Условие:** `userTrajectory.length >= 3` И `candidate.path.length >= 3`

Константа: `DTW_MIN_TRAJECTORY_LENGTH` в `config/scoring.ts`.

### Cypher Patterns

**recencyThresholdMonths:**
```
✅ duration.between(datetime(c.createdAt), datetime()).months <= $threshold
```

**filterByCurrentContext:**
```
✅ MATCH (u)-[:HAS_CONTEXT]->(c{contextId: u.currentContextId})  — только текущий
✅ MATCH (u)-[:HAS_CONTEXT]->(c)                                 — любой в истории
```

---

## 12. ТЕСТОВЫЕ ДАННЫЕ

### Kaggle users (225)

225 пользователей с 1319 контекстами из Kaggle resume dataset.

```bash
# 1. Поднять БД
npm run test:setup  # тестовая

# 2. Импорт
npx tsx scripts/import-kaggle.ts

# 3. Проверка: MATCH (u:User:Synthetic) RETURN count(u)
```

**Данные:** `data/kaggle-enriched.json`

### Fixture users (U1-U18)

- Тестовые данные для unit/integration
- Загружаются автоматически в globalSetup

### Проверка данных

```bash
# Сколько всего
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User)-[:HAS_CONTEXT]->(c) RETURN count(DISTINCT u), count(c)"
})
```

---

## 12.1 COLD-START-V2 FLOW

### Фазы

| Фаза | Что происходит |
|------|----------------|
| `story_gathering` | Сбор карьерной истории |
| `awaiting_plan_confirmation` | Показ плана (N контекстов) |
| `awaiting_clarification` | Запрос обязательных полей |
| `awaiting_context_confirmation` | Подтверждение каждого контекста (1/3) |
| `awaiting_final_confirmation` | Финальный preview |
| `saved` | Успешное сохранение |

### Архитектура NLP для story_gathering

**1 LLM вызов:** response-builders передаёт `messages[]`, NLP formatter генерирует текст.

**Data flow:**
```
gather_story → state.messages (накапливаются через reducer)
    ↓
response-builders → { phase, messages: [{role, content}] }
    ↓
NLP formatter → текст с acknowledge + follow-up
```

### Clarification/Confirmation UX Pattern

**Принцип:** OPTIONAL предлагаются в clarification, confirmation показывает только filled.

| Фаза | Progress | Показывает | OPTIONAL |
|------|----------|------------|----------|
| `awaiting_clarification` | `📍 Position 1/2: {preview}` | MISSING (required) | Предлагает кратко |
| `awaiting_context_confirmation` | `📍 Position 1/2` | Только filled fields | Не показывает |

**Response data (clarification):**
- `entityPreview` — preview текущего контекста
- `progress` — `{ current, total }`
- `missingFields` — required поля
- `optionalFields` — unfilled optional (типизированы через `ContextOptionalField`)

**Type-safe optional fields:**
```typescript
type ContextOptionalField = Exclude<keyof UserContext, ContextRequiredField | ContextSystemField>;
const CONTEXT_OPTIONAL_FIELDS = ["companySize", "birthYear", ...] as const satisfies readonly ContextOptionalField[];
```

---

## 13. ЧЕКЛИСТ НАЧАЛА СЕССИИ

- [ ] Поднять инфраструктуру: `npm run test:telegram:setup`
- [ ] Загрузить данные (если нужно): Kaggle import
- [ ] Запустить бота: `npm run bot:test`
- [ ] Открыть логи: `docker logs waymates-facade-test -f`
- [ ] Прочитать INSIGHTS.md — что было в прошлой сессии

---

## 14. ЧЕКЛИСТ ЗАВЕРШЕНИЯ СЕССИИ

- [ ] Записать найденные проблемы в INSIGHTS.md
- [ ] Записать изменённые файлы
- [ ] Запустить `npx tsc --noEmit`
- [ ] Commit если есть рабочие изменения

---

## Связанные документы

- **Инсайты**: `mvp-test-final/INSIGHTS.md`
- **LangSmith**: `docs/architecture/decisions/ADR-018-langsmith-observability.md`
- **LangGraph router**: `.claude/routers/langgraph/router.md`
- **Cypher router**: `.claude/routers/cypher/router.md`
- **Project context**: `.claude/context/project.md`
