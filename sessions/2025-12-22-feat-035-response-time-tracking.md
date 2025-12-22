# Session: FEAT-035 Response Time Tracking + Full Correlation

**Дата:** 2025-12-22
**Фича:** FEAT-035
**Статус:** 🟡 DESIGN COMPLETE, READY FOR IMPLEMENTATION

---

## Фаза 1: Research & Design (текущая сессия)

### Что сделано

1. **Ресерч E2E vs Load Testing**
   - Explore agent исследовал текущие тесты (314 integration), PoC (6 GramJS скриптов)
   - Вывод: Load testing не нужен для MVP (50-200 users), E2E достаточно
   - k6 — для HTTP, не для Telegram; GramJS — правильный выбор

2. **Ресерч Test DC vs Real Accounts**
   - Test DC уже настроен в проекте (`poc/generate-telegram-session.ts`)
   - Публичные номера: `+9996621111` (код: 11111)
   - Рекомендация: Test DC для concurrent testing

3. **Анализ текущего состояния FEAT-032/033**
   - Pino logging: ✅ реализован (shared logger, module singletons)
   - Sentry: ✅ реализован (captureException), но Performance выключен
   - **Gap найден:** нет `durationMs`, нет `requestId` propagation

4. **Дизайн FEAT-035**
   - Full correlation: requestId от Telegram до Neo4j
   - Timing на всех слоях: Telegram → Facade → Core → Neo4j
   - Sentry Performance: tracesSampleRate 0.1
   - **План создан:** `docs/mvp_final/FEAT-035-response-time-tracking.md`

### Ключевые решения

| Решение | Обоснование |
|---------|-------------|
| `requestId` = required (не nullable) | Breaking change OK, консистентность важнее |
| `tracesSampleRate: 0.1` | Free tier 10K/month, 200 users × 10 req × 30 days × 0.1 = 6K |
| tRPC middleware для timing | Централизованно, не в каждом роутере |
| Neo4j timing на `debug` level | Не спамить prod логи |

### Артефакты

- **План:** `docs/mvp_final/FEAT-035-response-time-tracking.md`
- **Research reports:** В контексте агентов (Test DC, k6, Sentry Performance)

---

## Что делать следующим

### Реализация FEAT-035 (8 этапов, ~1.5 часа)

1. **Schemas** (~10 LOC): `requestIdSchema` + обновить 4 MCP schemas
2. **Sentry** (~5 LOC): `tracesSampleRate: 0.1`
3. **Telegram handlers** (~10 LOC): requestId + telegramId + durationMs
4. **BaseTool** (~5 LOC): использовать `params.requestId` + durationMs
5. **withLogging HOF** (~5 LOC): durationMs на выходе
6. **Core tRPC** (~15 LOC): timing middleware
7. **Core DatabaseContext** (~10 LOC): timing в read/write
8. **Quality gates**: lint + tsc + tests (обновить fixtures с requestId)

### Breaking Changes

- `requestId` теперь required во всех MCP params
- Тесты нужно обновить — добавить `requestId: randomUUID()` в params

---

## Полезные ссылки

| Ресурс | Описание |
|--------|----------|
| `docs/mvp_final/FEAT-035-response-time-tracking.md` | Детальный план реализации |
| `docs/mvp_final/FEAT-032-pino-logging.md` | Pino архитектура |
| `docs/mvp_final/FEAT-033-sentry-integration.md` | Sentry интеграция |
| context7: `/trpc/trpc` | tRPC middleware API |
| context7: `/websites/sentry_io_platforms_javascript_guides_node` | Sentry startSpan API |

---

## Рефлексия

### Как делать правильно

1. **Проверять API через context7** перед написанием кода
   - tRPC middleware: `opts.next()`, `opts.path`, `result.ok`
   - Sentry: `startSpan({ name, op }, callback)`

2. **Читать существующий код** перед дизайном
   - FEAT-032/033 уже реализованы — не переделывать, а расширять
   - `BaseTool` уже логирует started/completed — добавить только durationMs

3. **Спрашивать про уверенность** в каждом компоненте
   - "Уверенность 90%+" — хороший threshold
   - Если меньше — проверить через grep/read/context7

### Как делать неправильно

1. ❌ **Смешивать темы в одном объяснении**
   - Пользователь сказал "ты смешал всё в кучу" — разделять Sentry/Pino/timing

2. ❌ **Предлагать nullable для backward compat**
   - Breaking changes OK если они улучшают архитектуру
   - `requestId: required` лучше чем `requestId?: nullable`

3. ❌ **Угадывать API без проверки**
   - tRPC middleware API мог быть другим
   - Sentry Performance API мог измениться

### Инсайты

1. **FEAT-032/033 реализованы, но не полностью**
   - "Отложено P1" в документе = реально отложено
   - requestId propagation — это отдельная задача, не часть FEAT-032

2. **Sentry Performance ≠ Error Tracking**
   - `tracesSampleRate` влияет только на Performance
   - `captureException` работает независимо от sample rate

3. **Full correlation требует изменений на ВСЕХ слоях**
   - Telegram → Facade → Core → Neo4j
   - Нельзя добавить только в одном месте

### Наставления от пользователя

| Наставление | Вывод |
|-------------|-------|
| "ты смешал всё в кучу" | Разделять темы, объяснять по одной |
| "без Nullable! breaking changes!" | Консистентность > backward compat для MVP |
| "requestId required" | Не делать optional то, что должно быть везде |
| "изучи код сначала + feat-032/033" | Читать существующий код перед дизайном |
| "не нужно ли в context7 сходить?" | Проверять API, не угадывать |
| "чтоб уверенность была 90%+" | Явно проверять каждый компонент |

---

## Промпт для rewind

```
Реализовать FEAT-035: Response Time Tracking + Full Correlation

Контекст:
- План: docs/mvp_final/FEAT-035-response-time-tracking.md
- Сессия: sessions/2025-12-22-feat-035-response-time-tracking.md

Статус: Design complete, ready for implementation.

Цель: requestId correlation + durationMs на всех слоях (Telegram → Facade → Core → Neo4j)

8 этапов:
1. Schemas: requestIdSchema + 4 MCP schemas
2. Sentry: tracesSampleRate 0.1
3. Telegram handlers: requestId + telegramId + durationMs
4. BaseTool: params.requestId + durationMs
5. withLogging: durationMs на выходе
6. Core tRPC: timing middleware
7. Core DatabaseContext: timing
8. Quality gates: lint + tsc + tests

Breaking change: requestId теперь required — обновить тесты.

Оценка: ~60 LOC, ~1.5 часа
```
