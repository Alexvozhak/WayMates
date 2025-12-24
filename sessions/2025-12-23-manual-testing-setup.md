# Сессия: Настройка ручного тестирования бота

**Дата**: 2025-12-23
**Цель**: Подготовить инфраструктуру для ручного тестирования Telegram бота с нуля

---

## Фаза 1: Настройка и первые проблемы

### Что сделано

1. **Document handler для PDF резюме**
   - Создан `src/telegram-bot/handlers/document.ts`
   - Зарегистрирован в `bot.ts` как `bot.on("message:document", handleDocument)`
   - Интегрирован с существующим MCP tool `parse_cv_to_text` (Gemini Vision)
   - Добавлен в `tool-registry.ts` для типизации

2. **Исправлены битые даты в Kaggle данных**
   - Обнаружено 36 контекстов с невалидными датами типа `"2009-2015-01T00:00:00Z"`
   - Причина: диапазоны лет в резюме ("2009-2015") неправильно преобразовывались
   - Исправлено через Cypher: взят MAX год из диапазона (конец периода)
   - Добавлена функция `normalizeDate()` в `scripts/import-kaggle.ts`

3. **Логирование для отладки**
   - `src/telegram-bot/middleware/timing.ts`: добавлен лог IN/OUT сообщений
   - `src/facade/langGraph/shared/with-logging.ts`: добавлен summarizeState для input/output nodes
   - `src/core/routers/trpc.ts`: добавлен лог tRPC started с summarizeInput

4. **Команда `bot:test` в package.json**
   - `"bot:test": "bash -c 'set -a && source .env.test && set +a && tsx src/telegram-bot/index.ts'"`
   - Автоматически загружает env переменные из `.env.test`

### Что делать дальше

1. **Проверить работу бота** — пройти cold-start flow вручную
2. **Загрузить Kaggle данные** — `npm run test:setup:kaggle` (даты уже исправлены в скрипте)
3. **Протестировать поиск** — убедиться что explore/search работает без ошибок дат

### Технические детали

- **Мониторинг логов**:
  - Facade: `docker logs waymates-facade-test -f`
  - Core: `docker logs waymates-core-test -f`
  - Bot: запущен через `npm run bot:test`

- **Запуск инфры**: `npm run test:telegram:setup`

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Использовать npm скрипты** — не извращаться с ручным `source .env.test`, а добавить команду в package.json
2. **Использовать правильные инструменты** — `TaskOutput` для background задач, `Read` для файлов, не `cat` через Bash
3. **Docker logs для pino** — все сервисы пишут в stdout, docker logs это правильный способ мониторинга
4. **Проверять данные в БД** — при ошибках сначала смотреть что реально лежит в Neo4j через MCP

### Как делать неправильно

1. Не использовать `cat` для чтения файлов — есть Read tool
2. Не запускать бота без env переменных — создать npm script
3. Не игнорировать ошибки формата дат — LLM может извлечь невалидные данные

### Инсайты

1. **Данные из LLM extraction могут быть невалидными** — нужна валидация/нормализация перед сохранением в БД
2. **Период "2009-2015" в резюме** — это не год, а диапазон. Для createdAt нужно брать END year (когда перешёл на следующую позицию)
3. **Логирование на всех уровнях** — Bot → Facade → Core — позволяет быстро найти где упало

### Наставления от пользователя

1. **"Почему не командами из package.json запускаешь?"** — Вывод: всегда использовать существующие npm scripts или создавать новые, а не хардкодить команды
2. **"Почему ты всё время cat читаешь?"** — Вывод: использовать правильные инструменты (Read, TaskOutput), не злоупотреблять Bash
3. **"Давай подготовим запуск инфры нормально"** — Вывод: автоматизировать повторяющиеся действия в npm scripts
4. **"По идее мы должны с конца даты считать"** — Вывод: понимать бизнес-логику данных, не просто технически фиксить

---

## Фаза 2: UX баг startAdhoc + подготовка к отладке

### Что сделано

1. **Изучен полный workflow Telegram → Facade → Core**
   - `handleConverse` → `classifyIntent` → `GraphManager.executeNewGraph` → `SearchGraph.run`
   - При `startAdhoc`: load_context извлекает adhocContext из сообщения
   - Если adhocContext = null → explore вызывает `search.byUser` → для нового пользователя = 0 результатов

2. **Исправлен UX баг: пустой контекст при startAdhoc**
   - **Проблема**: "Давай быстрый поиск" → extraction → null → explore → 0 results → пользователь уточняет → cancel
   - **Причина**: В route map для showing_exploration нет обработки clarify intent
   - **Корень**: Система не проверяла валидность adhocContext перед explore

   **Fix** (6 файлов):
   - `state.ts`: + фаза `asking_adhoc_context`, + `NODE.ask_adhoc_context`
   - `nodes/ask-adhoc-context.ts`: новая INTERRUPT нода с вопросом
   - `nodes/load-context.ts`: + функция `isAdhocContextValid()` + routing phase
   - `search-router.ts`: + `routeAfterLoadContext()`, + `LOAD_CONTEXT_ROUTE_MAP`
   - `search-graph.ts`: conditional edge после load_context
   - `shared/schemas.ts`: + фаза в `searchGraphResponseSchema`

3. **Создана база знаний для отладки**
   - `mvp-test-final/KNOWLEDGE-BASE.md` — единый док с архитектурой, бизнес-логикой, LangGraph, Cypher
   - `mvp-test-final/INSIGHTS.md` — для накопления инсайтов
   - `.claude/commands/manual-test-debug.md` — промпт-команда для сессий отладки

### Что делать дальше

1. **Протестировать fix** — написать "Давай быстрый поиск" → должен спросить контекст
2. **Проверить re-extraction** — после ответа пользователя контекст должен извлечься и поиск работать
3. **Покрыть тестом** — добавить integration test для startAdhoc без контекста

### Технические детали

**Валидация adhocContext** — минимум одно из:
- position (junior, senior)
- role (backend, data scientist)
- domains[] (1+ элемент)
- skills[] (1+ элемент)
- countryCode

**Новый flow**:
```
startAdhoc → load_context → isAdhocContextValid?
    ├─ YES → check_goal → explore
    └─ NO → ask_adhoc_context (interrupt) → load_context (re-extract)
```

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Использовать npm скрипты** — не извращаться с ручным `source .env.test`, а добавить команду в package.json
2. **Использовать правильные инструменты** — `TaskOutput` для background задач, `Read` для файлов, не `cat` через Bash
3. **Docker logs для pino** — все сервисы пишут в stdout, docker logs это правильный способ мониторинга
4. **Проверять данные в БД** — при ошибках сначала смотреть что реально лежит в Neo4j через MCP
5. **Понимать flow на 90%+ перед фиксом** — изучить весь путь данных, не гадать
6. **Задавать вопросы по бизнес-логике** — "что минимально нужно для поиска?" перед реализацией
7. **Использовать sequential-thinking** — для сложных UX решений с несколькими вариантами

### Как делать неправильно

1. Не использовать `cat` для чтения файлов — есть Read tool
2. Не запускать бота без env переменных — создать npm script
3. Не игнорировать ошибки формата дат — LLM может извлечь невалидные данные
4. Не предлагать костыли — "добавить clarify в route map" это симптом, не причина
5. Не торопиться с решением — сначала понять архитектуру, потом фиксить

### Инсайты

1. **Данные из LLM extraction могут быть невалидными** — нужна валидация/нормализация перед сохранением в БД
2. **Период "2009-2015" в резюме** — это не год, а диапазон. Для createdAt нужно брать END year
3. **Логирование на всех уровнях** — Bot → Facade → Core — позволяет быстро найти где упало
4. **explore.ts:23-32** — если adhocContext = null → вызывается search.byUser, не search.adhoc!
5. **Routing fallback** — если intent не в route map для фазы → default (часто cancel)
6. **Two-Node Pattern** — interrupt() прерывает, return не достигается → нужны отдельные ноды для бизнес-логики и interrupt
7. **UX первичен** — система должна помогать пользователю, спрашивать если чего-то не хватает

### Наставления от пользователя

1. **"Почему не командами из package.json запускаешь?"** — Вывод: всегда использовать существующие npm scripts или создавать новые
2. **"Почему ты всё время cat читаешь?"** — Вывод: использовать правильные инструменты (Read, TaskOutput)
3. **"Давай подготовим запуск инфры нормально"** — Вывод: автоматизировать повторяющиеся действия
4. **"По идее мы должны с конца даты считать"** — Вывод: понимать бизнес-логику данных
5. **"Ты должен быть уверен в бизнес-логике на 90%+"** — Вывод: читать код, спрашивать, не торопиться
6. **"Не предлагай костыли, только продуманные решения"** — Вывод: лечить причину, не симптом
7. **"Промпт команду в commands положи"** — Вывод: следовать структуре проекта

---

## Артефакты

### Фаза 1
- `src/telegram-bot/handlers/document.ts` — новый handler для PDF
- `scripts/import-kaggle.ts` — добавлена normalizeDate()
- `package.json` — добавлена команда `bot:test`

### Фаза 2
- `src/facade/langGraph/search-graph/nodes/ask-adhoc-context.ts` — новая нода
- `src/facade/langGraph/search-graph/nodes/load-context.ts` — + isAdhocContextValid()
- `src/facade/langGraph/search-graph/search-router.ts` — + routeAfterLoadContext
- `src/facade/langGraph/search-graph/search-graph.ts` — conditional edge
- `mvp-test-final/KNOWLEDGE-BASE.md` — база знаний для отладки
- `mvp-test-final/INSIGHTS.md` — инсайты сессий
- `.claude/commands/manual-test-debug.md` — команда для отладки

---

## Фаза 3: Ручное тестирование + исправление багов

### Что сделано

1. **Исправлен баг: User без Context ломает getState**
   - **Проблема**: `user.getState` падал с ошибкой "Expected exactly 1 current context, found 0"
   - **Причина**: `storyInputSchema` имел `.min(1)` для contexts, но adhoc user может не иметь контекстов
   - **Fix**: `shared/schemas.ts` — `.min(0)` + `MIN_CONTEXTS_FOR_CHAIN = 2` в superRefine

2. **Исправлен баг форматирования: "Сообщение (Русский):\n\""**
   - **Проблема**: LLM возвращал JSON-экранированную строку с `\"` и `\n`
   - **Причина**: `base-presenter.ts` делал `JSON.stringify(rawData)` для строки, LLM видел JSON и возвращал JSON
   - **Fix**: `system-message-presenter.ts` — парсить JSON.parse если строка начинается с `"`

3. **Улучшен extraction prompt**
   - **Проблема**: Из "Быстрый поиск" LLM галлюцинировал adhocContext
   - **Fix**: `prompts.ts` — переформулировка на "self-description about WHO they are", "command/request → null"

4. **Обновлён промпт manual-test-debug.md**
   - Добавлены принципы: комментируй действия, согласовывай, 90%+ уверенность
   - Добавлена инфраструктура: Postgres checkpoints, MCP сессии в Redis
   - Добавлен LangSmith workflow

5. **Включён LangSmith tracing**
   - `.env.test` — LANGSMITH_TRACING=true, LANGSMITH_PROJECT=waymates-manual-test

### Что делать дальше

1. **Протестировать extraction prompt** — "Быстрый поиск" должен вернуть adhocContext = null
2. **Проверить ask_adhoc_context flow** — после null должен спросить контекст
3. **Протестировать полный цикл** — ввод контекста → поиск
4. **Добавить npm scripts** — reset-checkpoints, rebuild-facade, restart-bot

### Технические детали

**Checkpoints в Postgres (НЕ Redis!)**:
```bash
docker exec waymates-postgres-test psql -U postgres -d waymates_facade_test \
  -c "TRUNCATE facade.checkpoints, facade.checkpoint_writes, facade.checkpoint_blobs CASCADE;"
```

**После пересборки facade** — бот теряет MCP сессию, нужен перезапуск

**LangSmith** — smith.langchain.com/o/waymates-manual-test для отладки промптов

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Использовать npm скрипты** — не извращаться с ручным `source .env.test`
2. **Использовать правильные инструменты** — `TaskOutput` для background задач, `Read` для файлов
3. **Docker logs для pino** — все сервисы пишут в stdout
4. **Проверять данные в БД** — при ошибках сначала смотреть что реально лежит в Neo4j
5. **Понимать flow на 90%+ перед фиксом** — изучить весь путь данных
6. **Задавать вопросы по бизнес-логике** — перед реализацией
7. **Использовать sequential-thinking** — для сложных UX решений
8. **Комментировать bash команды** — объяснять что делаешь
9. **Согласовывать "как было → как предлагаю"** — перед правками
10. **Лечить причину, не симптом** — разбираться глубоко
11. **Промпты без примеров** — только семантика

### Как делать неправильно

1. Не использовать `cat` для чтения файлов
2. Не запускать бота без env переменных
3. Не предлагать костыли
4. Не торопиться с решением
5. **redis-cli FLUSHALL для сброса checkpoints** — checkpoints в Postgres!
6. **Удалять данные без согласования** — можно сломать тест
7. **Примеры в промптах** — LLM будет копировать формат вместо понимания семантики

### Инсайты

1. **Данные из LLM extraction могут быть невалидными** — нужна валидация
2. **Период "2009-2015" в резюме** — это диапазон, брать END year
3. **Логирование на всех уровнях** — Bot → Facade → Core
4. **explore.ts** — если adhocContext = null → вызывается search.byUser
5. **Two-Node Pattern** — interrupt() прерывает, return не достигается
6. **UX первичен** — спрашивать если чего-то не хватает
7. **MCP сессии в Redis, checkpoints в Postgres** — разные хранилища!
8. **После пересборки facade** — бот теряет MCP сессию
9. **JSON.stringify на строку** — превращает в `"text"` с экранированием
10. **LLM галлюцинирует из коротких команд** — нужна семантическая защита в промпте

### Наставления от пользователя

1. **"Не давай команды без комментариев"** — объяснять что делаю
2. **"Согласовывай workflow: как было → как предлагаю"** — перед правками
3. **"Не делай бездумных правок"** — уверенность 90%+
4. **"Лечи причину, не симптом"** — разбираться глубоко
5. **"Промпты без примеров"** — только семантика
6. **"Ответы бота как от товарища"** — естественный диалог
7. **"Фиксируй спотыкания для улучшения промпта"** — рефлексия

---

## Артефакты

### Фаза 1
- `src/telegram-bot/handlers/document.ts` — новый handler для PDF
- `scripts/import-kaggle.ts` — добавлена normalizeDate()
- `package.json` — добавлена команда `bot:test`

### Фаза 2
- `src/facade/langGraph/search-graph/nodes/ask-adhoc-context.ts` — новая нода
- `src/facade/langGraph/search-graph/nodes/load-context.ts` — + isAdhocContextValid()
- `src/facade/langGraph/search-graph/search-router.ts` — + routeAfterLoadContext
- `src/facade/langGraph/search-graph/search-graph.ts` — conditional edge
- `mvp-test-final/KNOWLEDGE-BASE.md` — база знаний для отладки
- `mvp-test-final/INSIGHTS.md` — инсайты сессий
- `.claude/commands/manual-test-debug.md` — команда для отладки

### Фаза 3
- `src/shared/schemas.ts` — storyInputSchema.min(0) + MIN_CONTEXTS_FOR_CHAIN
- `src/telegram-bot/presenters/system-message-presenter.ts` — JSON.parse fix
- `src/facade/services/nlp-formatter/prompts.ts` — SEARCH_PROMPT короче
- `src/facade/langGraph/search-graph/prompts.ts` — extraction prompt без галлюцинаций
- `.env.test` — LangSmith tracing
- `.claude/commands/manual-test-debug.md` — обновлён с инфраструктурой

---

## Фаза 4: UX confirm_adhoc_context + дружеский стиль

### Что сделано

1. **Новая фаза confirm_adhoc_context**
   - **Зачем**: После extraction adhoc context спросить "что дальше?" вместо сразу explore
   - **UX**: "Окей, backend разработчик, TypeScript. Цели нет — есть готовая или помочь? Или глянуть похожих?"
   - **Файлы**: state.ts, nodes/confirm-adhoc-context.ts, search-router.ts, search-graph.ts, response-builders.ts, schemas.ts

2. **npm scripts для hot reload**
   - `npm run facade:rebuild` — пересборка facade + сброс checkpoints + --wait
   - `npm run bot:kill` — убить процесс бота
   - **Workflow**: `facade:rebuild && bot:kill && bot:test`

3. **targetCriteria → targetContext**
   - Унификация naming в Goal схеме
   - Затронуты: schemas.ts, goals-manager.ts, search-manager.ts, chart/, LangGraph nodes, тесты

4. **NLP промпт — дружеский стиль**
   - `src/facade/services/nlp-formatter/prompts.ts` — полностью переписан SEARCH_PROMPT
   - Стиль: "career buddy", "talk like texting a friend"
   - Каждая фаза с инструкцией на естественном языке

5. **Structured output gotcha**
   - LLM возвращает `""` вместо `null` при structured output
   - **Fix**: `load-context.ts` — фильтр пустых строк в hasAnyField

### Что делать дальше

1. **Протестировать confirm_adhoc_context** — бот должен спросить "что дальше?" после extraction
2. **Проверить дружеский стиль** — ответы должны быть неформальными
3. **Покрыть тестом** — integration test для нового flow
4. **Импортировать fixtures** — создать скрипт import-fixtures.ts (не Kaggle)

### Технические детали

**Новый flow adhoc:**
```
load_context → [adhoc valid?]
  ├─ YES → confirm_adhoc_context (interrupt) → parse_search_intent
  └─ NO  → ask_adhoc_context (interrupt) → load_context

confirm → user выбирает:
  ├─ proceed (no goal) → explore
  ├─ proceed (has goal) → search
  ├─ clarify → extract_goal
  └─ filter → ask_adhoc_context
```

**Routing flags**:
```typescript
type RouteFlags = {
  canClarify: boolean;
  canChangePosition: boolean;
  hasGoal: boolean;  // NEW
};
```

---

### Фаза 4 артефакты
- `src/facade/langGraph/search-graph/nodes/confirm-adhoc-context.ts` — новая нода
- `src/facade/langGraph/search-graph/state.ts` — + PHASE.confirming_adhoc_context, + NODE.confirm_adhoc_context
- `src/facade/langGraph/search-graph/search-router.ts` — + hasGoal flag, обновлён routing
- `src/facade/langGraph/search-graph/search-graph.ts` — + edge confirm_adhoc_context → parse_search_intent
- `src/facade/langGraph/search-graph/response-builders.ts` — + builder для confirming_adhoc_context
- `src/shared/schemas.ts` — + confirming_adhoc_context в searchGraphResponseSchema, targetCriteria → targetContext
- `src/facade/services/nlp-formatter/prompts.ts` — дружеский стиль
- `package.json` — + facade:rebuild, bot:kill
- `.claude/commands/manual-test-debug.md` — + секция "Спотыкания"
- `mvp-test-final/KNOWLEDGE-BASE.md` — обновлён flow

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Использовать npm скрипты** — facade:rebuild, bot:kill, bot:test
2. **ВСЕГДА перезапускать бота после facade:rebuild** — MCP сессия теряется
3. **Pino логгер, не console.log** — `import { logger } from "../../../logger.js"`
4. **Каждая новая фаза — 7 файлов** — state, node, router, graph, response-builder, schemas, nlp-prompts
5. **NLP промпты — дружеский стиль** — как товарищ, не корпоративный робот
6. **Обсуждать UX решения** — "Вариант A vs B, твои рекомендации как токсичного пользователя"

### Как делать неправильно

1. Не использовать `cat` для чтения файлов
2. Не забывать перезапускать бота после facade:rebuild
3. Не забывать добавлять фазу в NLP промпты — иначе LLM галлюцинирует
4. Не использовать console.log в facade — не попадёт в docker logs
5. Не менять routing без проверки что все ноды достижимы

### Инсайты

1. **Structured output: "" вместо null** — LLM часто возвращает пустые строки, нужен фильтр
2. **LangGraph UnreachableNodeError** — если нода в графе, но нет входящего edge
3. **NLP промпт без описания фазы** — LLM выдумывает заумный ответ
4. **pkill exit code 144** — нормально, сигнал перехвачен
5. **--wait вместо sleep** — docker сам ждёт healthy

### Наставления от пользователя

1. **"Запомни перезапускать бота после пересборки"** — добавить в скрипт/чеклист
2. **"У нас Pino логгер!"** — не console.log
3. **"Слишком заумные формулировки"** — переписать промпт на дружеский стиль
4. **"Не дублируйся"** — разные знания в разные файлы
5. **"Ответы как от товарища, беседа по душам"** — стиль общения везде

---

## Фаза 5: MCP Chat + Intent/Routing fixes

### Что сделано

1. **Интерактивный MCP клиент для ручного тестирования**
   - `poc/mcp-chat.ts` — скрипт для диалога с facade через MCP
   - Сессия сохраняется между вызовами в `/tmp/mcp-chat-session.json`
   - Команды: `--reset`, `--status`, или сообщение

2. **greeting intent**
   - `intent-classifier.ts` — + `greeting` в NON_GRAPH_INTENT
   - `flow-guard-checker.service.ts` — дружеское приветствие вместо unknown

3. **Улучшено описание startAdhoc**
   - Было: "wants quick search without saving profile"
   - Стало: "describes their professional identity or role, wants quick search"
   - Теперь "Я backend разработчик" → startAdhoc (не unknown)

4. **Улучшено описание PROCEED в USER_INTENT_PROMPT**
   - Было: "expresses a career goal, states what position..."
   - Стало: "agrees, confirms, wants to continue, explore, expresses a career goal..."
   - Теперь "давай" и "хочу senior" → proceed

5. **Добавлен clarify route для showing_exploration**
   - `search-router.ts` — `clarify: NODE.extract_goal`
   - Теперь "хочу senior" из exploration ведёт к extract_goal

6. **Fix: extract_goal использует clarificationText**
   - Проблема: при clarify intent `userResponse: ""`, текст в `clarificationText`
   - Fix: `textToExtract = userResponse || clarificationText || ""`

7. **Улучшен NLP prompt для showing_goal**
   - CRITICAL инструкция читать phase field
   - Детальное описание что показывать и какие опции предлагать

8. **Дружеские guard messages**
   - greetingMessage, helpMessage, unknownMessage — casual стиль

### Протестированный flow

```
"Я backend разработчик" → confirming_adhoc_context ✅
"давай" → showing_exploration ✅
"хочу senior" → showing_goal (position: senior) ✅
"добавь backend" → clarify_goal → merge (skills: backend) ✅
"сохрани" → showing_results ✅
```

### Что делать дальше

1. **Race condition тест** — 2+ сообщения одновременно
2. **Обновить E2E тесты** — `e2e-search-graph.integration.ts` уже частично обновлён
3. **Telegram E2E тесты** — через grammY или GramJS
4. **Проверить edge cases** — gibberish, смена темы, отмена в любой момент

### Технические детали

**MCP Chat usage:**
```bash
set -a && source .env.test && set +a
npx tsx poc/mcp-chat.ts "Привет"
npx tsx poc/mcp-chat.ts "Я backend"
npx tsx poc/mcp-chat.ts --reset
```

**Intent classification flow:**
```
User message → classifyIntent() → UserIntent
  ├─ greeting → greetingMessage
  ├─ startAdhoc → SearchGraph (adhoc mode)
  ├─ unknown → unknownMessage
  └─ ...
```

**clarify vs proceed:**
- `clarify` — сохраняет текст в clarificationText, очищает userResponse
- `proceed` — сохраняет userResponse
- extract_goal теперь fallback на clarificationText

---

### Фаза 5 артефакты
- `poc/mcp-chat.ts` — интерактивный MCP клиент
- `src/facade/services/orchestrator/intent-classifier.ts` — + greeting, улучшен startAdhoc
- `src/facade/services/orchestrator/flow-guard-checker.service.ts` — дружеские сообщения
- `src/facade/langGraph/search-graph/prompts.ts` — улучшены PROCEED, CRITICAL инструкция
- `src/facade/langGraph/search-graph/search-router.ts` — + clarify для showing_exploration
- `src/facade/langGraph/search-graph/nodes/extract-goal.ts` — fallback на clarificationText
- `src/facade/services/nlp-formatter/prompts.ts` — улучшен showing_goal

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Использовать npm скрипты** — facade:rebuild, bot:kill, bot:test
2. **ВСЕГДА перезапускать бота после facade:rebuild** — MCP сессия теряется
3. **Pino логгер, не console.log** — `import { logger } from "../../../logger.js"`
4. **Каждая новая фаза — 7 файлов** — state, node, router, graph, response-builder, schemas, nlp-prompts
5. **NLP промпты — дружеский стиль** — как товарищ, не корпоративный робот
6. **Проверять логи facade** — `docker logs waymates-facade-test --tail 50`
7. **Создавать интерактивные инструменты** — poc/mcp-chat.ts для быстрой отладки

### Как делать неправильно

1. Не добавлять примеры в промпты — **ТОЛЬКО семантика**
2. Не забывать про routing при добавлении intent — нужен маршрут в route map
3. Не игнорировать пустой userResponse — проверять clarificationText
4. Не писать непонятные команды — "глянуть похожих" → что это значит?

### Инсайты

1. **Intent description определяет classification** — если описание не покрывает use case, LLM не распознает
2. **Route map = source of truth** — если intent нет в map для фазы → default (cancel)
3. **clarify vs proceed** — разные поля state, нужно обрабатывать оба
4. **NLP игнорирует phase** — нужна CRITICAL инструкция явно читать phase field
5. **Дружеский стиль требует конкретики** — не "show goal", а "you're aiming to become a senior"

### Наставления от пользователя

1. **"НИКОГДА НЕ ДОБАВЛЯЙ ПРИМЕРЫ В ПРОМПТ"** — нарушает семантику, ограничивает LLM
2. **"Что за тупая команда 'глянуть похожих'?"** — UX должен быть явным, понятным
3. **"JSON в UX — это адекватно??"** — замечать проблемы пользователя, не игнорировать
4. **"Объясни что происходило"** — понимать и объяснять контекст правок
5. **"Расшифровывай фазу"** — откуда попадаем, что делаем, куда идём дальше

---

## Фаза 6: Race Condition Research + FEAT-041 Design

### Что сделано

1. **Обнаружен race condition баг**
   - При отправке 2+ сообщений одновременно — непредсказуемое поведение
   - Причина: оба request читают один checkpoint, обрабатываются параллельно
   - Один получил `system_message`, другой `cancelled`

2. **Глубокий ресерч решений** (через Explore agent)
   - LangGraph: нет встроенной защиты для параллельных invoke на один thread_id
   - MCP Protocol: JSON-RPC batching УДАЛЁН из спецификации (2025-06-18)
   - DataLoader: нет debounce (только nextTick) — не подходит

3. **Сравнение вариантов**
   | Вариант | Описание | Fit |
   |---------|----------|-----|
   | Mutex | Lock per user, sequential | ✅ Простой, но теряет контекст |
   | Reject | Отбивка "busy" | ❌ Теряет сообщение |
   | Buffer (in-memory) | Debounce + batch | ✅ **Выбран** |
   | Queue (Redis) | Persistent batch | ❌ Overkill для MVP |

4. **Найдена готовая библиотека: promise-batcher**
   - Promise API (не EventEmitter как Bottleneck)
   - Configurable debounce (queuingDelay)
   - 40k weekly downloads, zero deps
   - POC валидирован: `poc/test-promise-batcher.ts`

5. **Design FEAT-041 согласован**
   - `MessageBatcherService` в отдельном файле
   - DI через отдельный аргумент в ConverseTool (не в BaseToolDependencies)
   - Config: два аргумента (delayMs, maxSize), не объект
   - Env vars уже есть: `MESSAGE_BATCH_DELAY_MS`, `MESSAGE_BATCH_MAX_SIZE`

### Что делать дальше

```bash
/mvp-implement '/home/alex/projects/WayMatesRemote/tasks/features/FEAT-041-message-batcher.md'
```

**План реализации:**
1. Создать `src/facade/services/message-batcher.service.ts` (~35 LOC)
2. Создать инстанс в `index.ts`
3. Передать в `mcp-server.ts` → `ConverseTool`
4. Использовать в `converse.tool.ts`
5. Тесты: unit + manual

### Ключевые артефакты

- `tasks/features/FEAT-041-message-batcher.md` — полный design document
- `poc/test-promise-batcher.ts` — валидированный POC
- `poc/test-bottleneck-batcher.ts` — сравнительный POC (Bottleneck требует wrapper)

### Технические детали

**promise-batcher API:**
```typescript
import { Batcher } from "promise-batcher";

const batcher = new Batcher<string, Response>({
  batchingFunction: async (messages) => {
    const result = await process(messages);
    return messages.map(() => result);  // Same result for all
  },
  maxBatchSize: 10,
  queuingDelay: 300,
});

const result = await batcher.getResult("msg");  // Promise API!
```

**Интеграция (Вариант A):**
```typescript
// ConverseTool получает batcher отдельным аргументом
new ConverseTool(toolDeps, messageBatcherService)
```

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Глубокий ресерч перед реализацией** — Explore agent для сравнения вариантов
2. **Искать готовые библиотеки** — promise-batcher вместо самопала
3. **POC перед интеграцией** — валидировать API на изолированном примере
4. **DI через аргументы** — не глобальные синглтоны
5. **YAGNI** — не добавлять в BaseToolDependencies если только один tool использует

### Как делать неправильно

1. Не писать самопал если есть готовое решение
2. Не добавлять в общие deps то что нужно одному классу
3. Не создавать отдельный тип для 2 аргументов — просто два аргумента

### Инсайты

1. **LangGraph не защищает от race conditions** на одном thread_id — нужна внешняя защита
2. **MCP JSON-RPC batching удалён** — батчить на уровне приложения
3. **Bottleneck.Batcher = EventEmitter** — нужна обёртка для Promise API
4. **promise-batcher** — готовое решение с Promise API + debounce
5. **DataLoader не подходит** — нет debounce, только nextTick

### Наставления от пользователя

1. **"Запусти Explore agent для ресерча"** — глубокое исследование через агента
2. **"Сравни варианты с кодом и ценой"** — LOC, скоуп, риски
3. **"Не нужен отдельный тип для 2 аргументов"** — YAGNI
4. **"Через DI, создавать в main"** — правильная архитектура
5. **"Отдельный аргумент в ConverseTool"** — не раздувать BaseToolDependencies

---

## Фаза 7: FEAT-041 MessageBatcher — Client-Side Batching ✅ DONE

### Что сделано

1. **Архитектурное решение: батчинг в Telegram Bot, не в Facade**
   - **Проблема**: MCP — stateless протокол, `return ""` для followers ломает JSON.parse
   - **Исследование**: Explore agent → websearch + context7 → best practice = client-side batching
   - **Решение**: Перенести батчинг из Facade в Telegram Bot
   - **Причины**:
     - MCP остаётся stateless (можно scale горизонтально)
     - LibreChat не нуждается в батчинге (синхронный flow)
     - Followers не делают HTTP запросы вообще

2. **Удалено из Facade**
   - `src/facade/services/message-batcher.service.ts` — удалён
   - `src/facade/mcp-server/mcp-server.ts` — убран messageBatcherService параметр
   - `src/facade/mcp-server/tools/converse.tool.ts` — возвращает простой ConverseResponse
   - `src/facade/index.ts` — убрано создание batcher
   - `src/facade/env.ts` — убраны MESSAGE_BATCH_* конфиги

3. **Добавлено в Telegram Bot**
   - `src/telegram-bot/services/message-batcher.service.ts` — **NEW** (~80 LOC)
   - `src/telegram-bot/types.ts` — messageBatcher в BotServices
   - `src/telegram-bot/index.ts` — создание и DI
   - `src/telegram-bot/env.ts` — MESSAGE_BATCH_* конфиги
   - `src/telegram-bot/handlers/converse.ts` — интеграция с batcher

4. **Документация обновлена**
   - `tasks/features/FEAT-041-message-batcher.md` — статус DONE, финальная архитектура
   - `docs/mvp_final/MVP-RELEASE-PLAN.md` — добавлен в таблицу фич + changelog

### Финальная архитектура

```
Telegram Handler (converse.ts)
    ↓
MessageBatcherService.enqueue(telegramUserId, message, process)
    ↓
[Batcher per user, debounce 300ms]
    ↓
Leader: process(combined) → mcpClient.callTool("converse") → response → ctx.reply()
Followers: null → skip reply
```

### Quality Gates

- ✅ `npx tsc --noEmit` — проходит
- ✅ `npm run lint:fix` — pre-existing ошибки (не наши)

### Артефакты

| Файл | Действие |
|------|----------|
| `src/telegram-bot/services/message-batcher.service.ts` | **NEW** |
| `src/telegram-bot/types.ts` | +messageBatcher |
| `src/telegram-bot/index.ts` | +create, +DI |
| `src/telegram-bot/env.ts` | +MESSAGE_BATCH_* |
| `src/telegram-bot/handlers/converse.ts` | +batcher integration |
| `src/facade/services/message-batcher.service.ts` | **DELETED** |
| `src/facade/mcp-server/*.ts` | -batcher param |
| `src/facade/env.ts` | -MESSAGE_BATCH_* |

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Union типы для явных контрактов** — `| { type: "leader" } | { type: "follower" }` лучше чем `| null`
2. **Выносить inline callbacks в методы** — `createOptions`, `processBatch`
3. **Комментарии для "хаков"** — объяснять требования библиотеки
4. **Early return для уменьшения вложенности** — `if (!result.ok) { ... }`
5. **Понимать механику библиотеки** — promise-batcher требует массив результатов matching input length
6. **Client-side batching для stateless серверов** — MCP не должен хранить state для батчинга
7. **Explore agent для архитектурных решений** — websearch + context7 перед реализацией

### Как делать неправильно

1. **null вместо union типа** — размывает логику
2. **Inline objects в конструкторах** — непонятно что за тип
3. **Батчинг на stateless сервере** — нарушает идеологию протокола
4. **Принимать первое решение** — сначала research, потом implement

### Инсайты

1. **promise-batcher API** — `batchingFunction` получает массив inputs, должен вернуть массив results той же длины
2. **Leader/Follower паттерн** — только первый caller получает реальный ответ, остальные — null
3. **MCP пустой ответ** — клиент пытается парсить JSON, падает на пустой строке
4. **Batching per-user** — Map<telegramUserId, Batcher> изолирует пользователей
5. **Client-side batching** — сервер остаётся stateless, клиент контролирует race condition
6. **LibreChat не нуждается в батчинге** — синхронный flow, пользователь ждёт ответа

### Наставления от пользователя

1. **"Но тогда нужно на каждом клиенте реализовывать батчинг??"** — да, но это ~5 строк на клиент vs ломать MCP
2. **"А клиентская LLM без спец промпта разрулит это?"** — нет, LibreChat не знает про `{batched:true}`
3. **"Ой давай батчинг в телегу переводить"** — правильное решение: client-side
