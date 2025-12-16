---
name: implement-telegram-bot
description: Реализация Telegram Bot (grammY + HTTP MCP). Строго по ADR-028 и плану.
model: sonnet
---

# Telegram Bot Implementation

> **Архитектура**: grammY + HTTP MCP Client к Facade
> **План**: `.claude/plans/sequential-knitting-cat.md`
> **ADR**: `docs/architecture/decisions/ADR-028-telegram-bot-architecture.md`

Ты реализуешь Telegram Bot для WayMates. **СТРОГО следуй плану**, не импровизируй.

---

## Загрузи контекст (ОБЯЗАТЕЛЬНО в начале)

```bash
# 1. План (ГЛАВНЫЙ документ) — все решения здесь
Read .claude/plans/sequential-knitting-cat.md

# 2. ADR (архитектура)
Read docs/architecture/decisions/ADR-028-telegram-bot-architecture.md

# 3. ESLint правила
Read eslint.config.mjs

# 4. grammY Context Extension
WebFetch https://grammy.dev/guide/context

# 5. Facade auth (для понимания register_telegram)
Read src/facade/mcp-server/auth.service.ts
Read src/facade/mcp-server/schemas.ts
```

---

## После загрузки контекста

**НЕ НАЧИНАЙ сразу!** Проверь:

1. **Открытые вопросы в плане** (OQ*) — если есть нерешённые, предложи решить
2. **Принятые решения** (D1-D4) — это source of truth, не менять
3. **Текущая фаза** — начинай с первой незавершённой

Через `AskUserQuestion` предложи выбор с чего начать.

---

## Фазы работы

### Phase 1: Core Types
- `src/telegram-bot/types.ts` — BotContext, BotServices
- `src/telegram-bot/errors.ts` — BotError, SessionExpiredError
- `src/telegram-bot/env.ts` — Zod validation
- **CHECKPOINT** → показать файлы → ждать ✅

### Phase 2: MCP Client
- `src/telegram-bot/mcp-client.ts` — HTTP client + session retry
- Архитектура из плана (OQ5 решение):
  ```typescript
  const sessions = new Map<number, string>();
  export async function callTool(ctx, toolName, params) { ... }
  ```
- **CHECKPOINT** → показать файл → ждать ✅

### Phase 3: Bot Core
- `src/telegram-bot/bot.ts` — grammY instance + middleware
- `src/telegram-bot/index.ts` — entry point
- Context Extension pattern (D3 решение)
- **CHECKPOINT** → показать файлы → ждать ✅

### Phase 4: Handlers
- `src/telegram-bot/handlers/start.ts` — /start → register_telegram
- `src/telegram-bot/handlers/story.ts` — /story → cold_start
- `src/telegram-bot/handlers/search.ts` — /search → search_by_target
- `src/telegram-bot/handlers/link.ts` — /link → link_telegram
- `src/telegram-bot/handlers/help.ts` — /help
- `src/telegram-bot/handlers/cancel.ts` — /cancel
- **CHECKPOINT** → показать handlers → ждать ✅

### Phase 5: Callbacks
- `src/telegram-bot/handlers/callbacks.ts` — InlineKeyboard handlers
- decision:approve, decision:edit, decision:cancel
- **CHECKPOINT** → показать файл → ждать ✅

### Phase 6: Voice (опционально)
- `src/telegram-bot/services/whisper.ts` — OpenAI Whisper STT
- Voice flow по решению D4 (Menu-first)
- **CHECKPOINT** → показать файл → ждать ✅

### Phase 7: NLP Parser (опционально)
- `src/telegram-bot/services/nlp-parser.ts` — GPT-4o-mini
- Только для tools требующих JSON (search_by_target)
- **CHECKPOINT** → показать файл → ждать ✅

### Phase 8: Quality Gates
- `npm run lint:fix` — без ошибок
- `npx tsc --noEmit` — без ошибок
- **ФИНАЛЬНЫЙ CHECKPOINT** → ждать ✅

---

## Запреты (18 правил)

### Код (10)
1. ❌ НЕ делать реэкспорты (`export * from`)
2. ❌ НЕ использовать `any` — только явные типы
3. ❌ НЕ использовать type assertions (`as`) — только Zod `.parse()`
4. ❌ НЕ превышать complexity 8
5. ❌ НЕ превышать max-depth 2
6. ❌ НЕ превышать 60 строк на функцию
7. ❌ НЕ добавлять doxygen/отладочные комментарии
8. ❌ НЕ создавать типы без grep проверки
9. ❌ НЕ использовать defensive programming (`?.` на инвариантах)
10. ❌ НЕ прогибать типы optional полями ради "гибкости"

### Архитектура (4)
11. ❌ НЕ додумывать бизнес-логику — СПРАШИВАТЬ
12. ❌ НЕ менять принятые решения (D1-D4) — это source of truth
13. ❌ НЕ пропускать checkpoints — ждать одобрения
14. ❌ НЕ переходить к следующей фазе без завершения текущей

### Process (4)
15. ❌ НЕ запускать lint без fix — сразу исправлять
16. ❌ НЕ игнорировать TypeScript ошибки
17. ❌ НЕ оставлять рудименты — удалять неиспользуемый код
18. ❌ НЕ смешивать разные фазы — одна фаза = один scope

---

## Триггеры вызова пользователя

### ОБЯЗАТЕЛЬНО звать когда:

**Бизнес-логика**:
- "Как обрабатывать X в случае Y?"
- Любая неясность в требованиях

**Выбор между альтернативами**:
- "Два подхода: A vs B — какой выбрать?"
- Любой выбор без очевидного ответа

**Конфликты с планом/ADR**:
- "План говорит X, но код делает Y"
- Несоответствие в документации

**Checkpoints** (после КАЖДОЙ фазы):
- Phase N завершена → показать результат → ЖДАТЬ ✅

**Ошибки**:
- Если lint/tsc ошибка требует архитектурного решения
- Если что-то не работает по непонятной причине

### НЕ СПРАШИВАЙ:
- Очевидные технические решения
- Выбор между эквивалентными подходами
- Что делать при ошибке lint/tsc (просто исправь)

---

## Принятые решения (из плана)

| ID | Решение | Детали |
|----|---------|--------|
| D1 | Error Handling | Централизованный `bot.catch()` + типизированные ошибки |
| D2 | Структура файлов | Гибрид Layers + Flat (см. ADR-028) |
| D3 | Handler Pattern | Context Extension (grammY Flavors) |
| D4 | Voice Flow | Menu-first + запрет ввода без выбора |
| OQ5 | Session Management | Retry в callTool, Facade следит за TTL |

---

## Quality Gates

**После КАЖДОЙ фазы:**
```bash
npm run lint:fix
npx tsc --noEmit
```

---

## Структура проекта (target)

```
src/telegram-bot/
├── index.ts           # Entry point
├── bot.ts             # grammY Bot + middleware
├── env.ts             # Env validation (Zod)
├── types.ts           # BotContext
├── errors.ts          # BotError classes
├── mcp-client.ts      # HTTP MCP + session retry
│
├── handlers/
│   ├── start.ts       # /start
│   ├── story.ts       # /story
│   ├── search.ts      # /search
│   ├── link.ts        # /link
│   ├── help.ts        # /help
│   ├── cancel.ts      # /cancel
│   └── callbacks.ts   # InlineKeyboard
│
└── services/
    ├── whisper.ts     # OpenAI Whisper STT
    └── nlp-parser.ts  # GPT-4o-mini parser
```

---

## Антипаттерны

1. ❌ Создавать типы без grep проверки
2. ❌ Дублировать логику session management
3. ❌ Inline type imports
4. ❌ Функции > 60 строк
5. ❌ Импровизировать вместо следования плану
6. ❌ Defensive coding на invariants (`?.` где не нужно)
7. ❌ Сырой `Error` — всегда через `errors.ts`
8. ❌ Обёртки ради одной строки

---

## Перед каждым действием

1. **Проверь текущую фазу**
2. **Загрузи необходимый контекст**
3. **Проверь запреты** (18 правил)
4. **Выполни задачу** текущей фазы
5. **Запусти lint + tsc**
6. **Покажи результат** и жди checkpoint

---

## ВАЖНО

- **План = Source of Truth** — не отступать от решений
- **Checkpoint после КАЖДОЙ фазы** — не пропускать
- **При сомнениях — СПРАШИВАТЬ** — не додумывать
- **Качество важнее скорости** — не торопиться
