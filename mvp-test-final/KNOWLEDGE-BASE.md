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

### Где искать

| Что ищу                     | Где смотреть                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| Поиск кандидатов            | `src/core/search-manager.ts`                                     |
| Cypher queries              | `src/cypher/queries/search.ts`                                   |
| SearchGraph nodes           | `src/facade/langGraph/search-graph/nodes/`                       |
| Extraction prompts          | `src/facade/langGraph/search-graph/prompts.ts`                   |
| Routing логика              | `src/facade/langGraph/search-graph/search-router.ts`             |
| State и фазы                | `src/facade/langGraph/search-graph/state.ts`                     |
| Intent classification       | `src/facade/services/orchestrator/intent-classifier.ts`          |
| Flow guards (help, unknown) | `src/facade/services/orchestrator/flow-guard-checker.service.ts` |
| Форматирование ответов      | `src/facade/services/nlp-formatter/prompts.ts`                   |
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

| Фаза                       | Что происходит                                |
| -------------------------- | --------------------------------------------- |
| `asking_adhoc_context`     | Просим контекст (нет данных для поиска)       |
| `confirming_adhoc_context` | Подтверждаем контекст, спрашиваем что дальше  |
| `showing_exploration`      | Показываем кандидатов без goal                |
| `showing_goal`             | Показываем извлечённую цель для подтверждения |
| `showing_results`          | Финальные результаты с pathfinder/waymate     |

### Валидация adhocContext

Минимум для поиска (хотя бы одно):

- position (junior, senior)
- role (backend, frontend)
- countryCode
- domains[] (1+ элемент)
- skills[] (1+ элемент)

---

## 6. LANGGRAPH — КРИТИЧЕСКИЕ ПРАВИЛА

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

### Two-Node Pattern

Когда нужно сгенерировать + показать:

```
generate_* (бизнес → state) → show_* (interrupt)
```

Потому что interrupt() прерывает — return не достигается.

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

| Ситуация                    | Плохой UX         | Хороший UX               |
| --------------------------- | ----------------- | ------------------------ |
| Контекст не извлечён        | Пустые результаты | Спросить явно            |
| Unknown intent              | Cancel            | Уточнить что имел в виду |
| Clarify в неожиданном месте | Cancel            | Принять уточнение        |

---

## 11. ТЕСТОВЫЕ ДАННЫЕ

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

## 12. ЧЕКЛИСТ НАЧАЛА СЕССИИ

- [ ] Поднять инфраструктуру: `npm run test:telegram:setup`
- [ ] Загрузить данные (если нужно): Kaggle import
- [ ] Запустить бота: `npm run bot:test`
- [ ] Открыть логи: `docker logs waymates-facade-test -f`
- [ ] Прочитать INSIGHTS.md — что было в прошлой сессии

---

## 13. ЧЕКЛИСТ ЗАВЕРШЕНИЯ СЕССИИ

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
