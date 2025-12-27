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

| Термин            | Описание                                                   |
| ----------------- | ---------------------------------------------------------- |
| **Context**       | Одна позиция в карьере (роль, навыки, домен, компания)     |
| **Trajectory**    | Цепочка Context-ов пользователя (карьерный путь)           |
| **Goal**          | Желаемая позиция пользователя                              |
| **Pathfinder**    | Кандидат, который УЖЕ достиг цели пользователя             |
| **Waymate**       | Кандидат с ТОЙ ЖЕ целью (ещё не достиг)                    |
| **Adhoc Context** | Временный контекст из сообщения (не сохраняется в профиль) |

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

**Архитектура валидации:**
```
adhocContextBase (все nullable) → LLM extraction
           ↓
adhocContextRequiredSchema (.omit().extend()) → Zod safeParse
           ↓
missingFields[] → response → NLP показывает пользователю
```

**Schema derivation pattern:**
```typescript
// Наследование от nullable схемы с заменой required полей
export const adhocContextRequiredSchema = adhocContextBase
  .omit({ position: true, role: true, countryCode: true, domains: true })
  .extend({
    position: z.string().min(1),
    role: z.string().min(1),
    countryCode: z.string().min(1),
    domains: z.array(z.string()).min(1),
  });
```

**LLM Merge:** Если контекст неполный → `ask_adhoc_context` → пользователь дополняет → `load_context` использует `clarifyAdhocContext` для merge (LLM объединяет старое + новое).

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
3. **userResponse очищать** после использования (`userResponse: ""`)
4. **buildRouteMap** должен содержать ВСЕ возможные return values роутера
5. **unknown intent → safe fallback**, не infinite loop
6. **Optional Zod field**: undefined (отсутствие), НЕ null
7. **LLM merge pattern** для incremental input — передавать текущее состояние в промпт
8. **Structured output gotcha**: LLM возвращает `""` вместо `null` — фильтровать в extraction functions

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

## 10. БИЗНЕС-ЛОГИКА UX

### Роль токсичного пользователя

При тестировании думай как пользователь который:

- Не читает инструкции
- Пишет кратко и неформально
- Ожидает что бот поймёт контекст
- Раздражается когда бот отменяет действие
- Хочет простой и понятный flow

### Примеры плохого UX (что искать)

| Ситуация                    | Плохой UX                | Хороший UX                  |
| --------------------------- | ------------------------ | --------------------------- |
| Контекст не извлечён        | Пустые результаты        | Спросить явно               |
| Unknown intent              | Cancel                   | Уточнить что имел в виду    |
| Clarify в неожиданном месте | Cancel                   | Принять уточнение           |
| Много кандидатов (>10)      | Token limit error        | Progressive Disclosure      |
| 0 результатов               | "Ничего не найдено"      | Показать фильтры + missing  |

### Progressive Disclosure Pattern

Когда candidates > threshold (10, см. `FACETS_MAX_CANDIDATES`):
1. Показать **facets** — распределение с counts по полям:
   - Countries, Citizenships, Positions, Roles, Industries
2. Предложить выбрать фильтр: "Technology (31), Healthcare (8) — какая индустрия?"
3. После фильтра — полный анализ + Chart

Зачем: избежать token limit, помочь пользователю сузить выбор.

### Прозрачность = доверие

| Что показать | Зачем |
|--------------|-------|
| Missing fields | "we're missing position" → понятно почему такие результаты |
| Applied filters | "искали: senior, backend, Europe" → можно скорректировать |
| Counts | "найдено 20 pathfinders, 5 waymates" → масштаб понятен |

### Intent семантика

| Intent | Значение | Роутинг |
|--------|----------|---------|
| `change` | Полная замена цели | `extract_goal` (с нуля) |
| `clarify` | Дополнить существующую | `clarify_goal` (merge) |
| `proceed` | Согласие БЕЗ новой инфо | depends on hasGoal |
| `validate` | "покажи реальных людей" | `validate_goal` |
| `save` | Явное сохранение | `set_goal` → `ask_search_mode` |
| `searchWaymates` | Выбрал попутчиков | `search_waymates` |
| `searchPathfinders` | Выбрал проводников | `search_pathfinders` |
| `ask` | Мета-вопрос о боте | `generate_answer` (advisor) |

**Важно:** `ask` должен быть в КАЖДОЙ фазе — пользователь может спросить "что ты умеешь?" в любой момент.

### Intent Architecture (Single Source of Truth)

Intent'ы определены в `state.ts` как const arrays:
- `SIMPLE_INTENTS` — без доп. полей в schema (proceed, explore, save, change, delete, searchWaymates, searchPathfinders, cancel, unknown)
- `COMPLEX_INTENTS` — с clarificationText/filters/question (validate, clarify, filter, ask)
- `SearchUserIntent = SimpleIntent | ComplexIntent` — derived type

**Где используются:**
1. `state.ts` — SIMPLE_INTENTS/COMPLEX_INTENTS arrays
2. `parse-intent.ts` — `z.enum(SIMPLE_INTENTS)` в Zod schema
3. `classification.ts` — `INTENT_DESCRIPTIONS: Record<SearchUserIntent, string>`
4. `search-router.ts` — `createIntentRoutes(flags)` возвращает valid intents по фазам

**При добавлении нового intent:** обновить 3 места: state.ts, classification.ts, search-router.ts

**ВАЖНО:** Prompt для classification строится динамически из router — показывает ТОЛЬКО valid intents для текущей фазы. `getValidIntentsForPhase(phase, flags)` = source of truth.

### explore vs proceed

| Intent | Semantic | Когда |
|--------|----------|-------|
| `proceed` | Согласие БЕЗ новой информации | "да", "ок", "давай" |
| `explore` | Запрос на просмотр похожих | "глянь похожих", "покажи кандидатов" |

**Routing explore с учётом hasGoal:**
- `hasGoal=false` → NODE.explore (browse UI)
- `hasGoal=true` → NODE.search_waymates (results UI с фильтрацией по цели)

### Chart Generation

| Нода | Chart? | Mode | Условие |
|------|--------|------|---------|
| `show_results` | ✅ | `full` | userTrajectory.length > 0 |
| `validate_goal` | ✅ | `goal-only` | candidates.length > 0 |
| `explore` | ✅ | `full` / `candidates-only` | userTrajectory или adhocContext |

**3 режима Chart (discriminated union):**
- `full` — user trajectory + candidates (overlap, spider chart)
- `candidates-only` — adhoc marker + candidates (no overlap)
- `goal-only` — только candidates + Goal Line (для validate-goal)

**Конвертация типов:**
- `PathfinderCandidate` → `ScoredMatchedCandidate` (show-results.ts)
- `MatchedCandidateWithPath` → `ScoredMatchedCandidate` (validate-goal.ts)

**Ключевые файлы:**
- Types: `src/chart/types.ts`
- Transformer: `src/chart/services/trajectory-transformer.ts`
- Builder: `src/chart/builders/chart-builder.ts`

---

## 11. SEARCH ARCHITECTURE (Core)

### Три режима поиска

| Режим | Кого ищем | Ключевые параметры |
|-------|-----------|-------------------|
| **searchWaymates** | Похожие люди (adhoc ИЛИ profile) | `referenceContext?`, `recencyMonths`, `isWaymate: true` |
| **searchPathfinders** | Кто прошёл от нашего контекста к нашей цели | `referenceContext` + `targetContext`, dual recency |
| **reverseSearchPathfinders** | Кто достиг target (любой старт) | `targetContext`, для валидации цели |

### Бизнес-смысл каждого режима

1. **Waymates** = похожие люди (unified: adhoc + profile)
   - Match: candidate имеет контекст похожий на наш (любой в истории)
   - `isWaymate: boolean` — кандидат имеет ту же цель что и мы
   - Ценность: "кто ещё в моей ситуации"

2. **Pathfinders** = proof of transition
   - Match 1: candidate.history содержит our.referenceContext (был где мы)
   - Match 2: candidate.history содержит our.targetContext (достиг куда мы хотим)
   - Temporal: refContext.createdAt < targetContext.createdAt
   - Dual recency: `targetRecencyMonths` + `referenceRecencyMonths`
   - Ценность: "путь возможен, вот доказательство"

3. **ReversePathfinders** = reverse engineering (откуда приходят на target)
   - Match: candidate.history содержит target
   - Recency на target: "он недавно достиг target?"
   - Ценность: валидация цели, "откуда люди приходят на эту позицию"

### Adhoc vs Profile

Adhoc/Profile — это НЕ режим поиска, а источник referenceContext:

| Источник | referenceContext | Доступные режимы |
|----------|------------------|------------------|
| **Adhoc** | Из сообщения пользователя | Waymates, Pathfinders (если goal есть) |
| **Profile** | Из DB (user.currentContextId) | Все три |

### Где искать (файлы)

| Компонент | Файл |
|-----------|------|
| Cypher queries | `src/cypher/queries/search.ts` |
| SearchManager | `src/core/search-manager.ts` |
| tRPC Router | `src/core/routers/search.ts` |
| Facade nodes | `src/facade/langGraph/search-graph/nodes/explore.ts`, `validate-goal.ts` |
| Types | `src/shared/schemas.ts` |

### recencyThresholdMonths

Фильтр по возрасту контекста в месяцах:

```cypher
duration.between(datetime(matchedContext.createdAt), datetime()).months <= $recencyThresholdMonths
```

- **Waymates**: recency на candidate.currentContext — "он ещё там?"
- **Pathfinders/Reverse**: recency на goalContext — "он недавно достиг?"

### filterByCurrentContext (Cypher)

```cypher
// filterByCurrentContext = true
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context{contextId: u.currentContextId})
// → только ТЕКУЩИЙ контекст кандидата (для Waymates)

// filterByCurrentContext = false
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
// → ЛЮБОЙ контекст в истории (для Pathfinders/Reverse)
```

### isWaymate в результатах

| isWaymate | Значение | Когда |
|-----------|----------|-------|
| `true` | Кандидат имеет ту же цель | Waymates search + goal совпадает |
| `false` | Нет goal или другая цель | Нет goal или не матчится |

**Примечание:** `candidateType` enum удалён, заменён на `isWaymate: boolean`.

### DTW Architecture (где вычисляется)

DTW вычисляется **в TypeScript**, не в Cypher:

| Слой | Роль в DTW |
|------|------------|
| **Cypher** | Возвращает кандидатов с `path` (траекторией) |
| **Core TypeScript** | `TrajectorySimilarityService.computeDTWMetrics()` вычисляет метрики |
| **SearchManager** | Orchestrator: получает кандидатов → обогащает DTW → возвращает |

**Условие для DTW расчёта:**
- `userTrajectory.length >= 3` (минимум 3 контекста у пользователя)
- `candidate.path.length >= 3` (минимум 3 контекста у кандидата)

**Где вызывается:**
- `searchWaymates` (profile mode) → `executeCoreSearchWithDTW()` → DTW есть
- `searchWaymates` (adhoc mode) → DTW нет (нет userTrajectory)
- `searchPathfinders` → DTW нет (TODO: добавить)

**Ключевые файлы:**
- `src/core/trajectory-similarity.service.ts` — вычисление DTW метрик
- `src/core/search-manager.ts` — orchestration DTW обогащения

---

## 12. ТЕСТОВЫЕ ДАННЫЕ

### Kaggle users (225)

- Реальные карьерные истории
- Загружаются: `npx tsx scripts/import-kaggle.ts`

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
