# FEAT-033: Sentry Error Monitoring

**Статус:** ✅ DONE
**Приоритет:** P0
**Зависимости:** FEAT-032 (Pino Logging)
**Блокирует:** Production Deploy (Фаза 7)

---

## Цель

Error monitoring с Telegram alerts для всех модулей. Единый Sentry Project с тегами для разделения модулей.

---

## Реализованная архитектура

```
┌─────────────────────────────────────────────────────────────┐
│              Sentry Project: waymates (1 project)           │
├─────────────────────────────────────────────────────────────┤
│  telegram-bot ──┐                                           │
│  facade       ──┼──▶ Tags: module, tool, userId, sessionId  │
│  core         ──┘    ──▶ Telegram Chat (alerts)             │
└─────────────────────────────────────────────────────────────┘
```

**Почему 1 проект вместо 3:**
- Проще управлять (один DSN)
- Теги достаточны для фильтрации (`module: facade/telegram/core`)
- Free tier ограничен — лучше не распылять лимиты

---

## Что реализовано

### 1. Shared Sentry (`src/shared/sentry.ts`)

```typescript
export function initSentry(dsn: string | undefined, service: string): void
export function captureException(error: unknown, tags: SentryTags): void
```

### 2. Full Correlation (Sentry ↔ Pino)

Теги по модулям для корреляции с логами:

| Модуль | Теги |
|--------|------|
| telegram | `telegramUserId`, `userId?`, `sessionId?` |
| facade | `tool`, `userId?`, `sessionId?` |
| core | `path` |

### 3. withLogging HOF

Type-safe HOF для LangGraph nodes с автоматическим логированием:

```typescript
// Фабрика с типизацией по NODE enum
export const withLogging = createWithLogging<typeof NODE>();

// Использование
export const searchNode = withLogging<SearchStateType>(NODE.search, async (state, config, deps) => {
  // ...
});
```

### 4. sessionId → uuidv7 (consistency fix)

Изменён формат sessionId для консистентности с userId:
- Было: `sess_${randomHex32}`
- Стало: `sess_${uuidv7}`

---

## Environment Variables

```bash
# .env (единый DSN для всех модулей)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

Без DSN — Sentry отключён, только Pino logging.

---

## Acceptance Criteria

- [x] Sentry Project создан
- [x] Telegram Alerts Bot подключен
- [x] Alert Rules настроены
- [x] `src/shared/sentry.ts` создан
- [x] `initSentry()` вызывается в каждом модуле
- [x] `captureException()` с тегами в error handlers
- [x] PoC: ошибка → alert в Telegram ✅
- [x] `npm run lint` — 0 errors
- [x] `npx tsc --noEmit` — 0 errors
- [x] Unit tests — 67 passed

---

## Документация

- [DEBUGGING-LOGS.md](../../docs/business/DEBUGGING-LOGS.md) — обновлён workflow Sentry ↔ Pino
- [Session Report](../../sessions/2025-12-22-feat-033-sentry-integration.md)

---

## PoC Tests

```bash
# Базовый тест
SENTRY_DSN=xxx npx tsx poc/test-sentry.ts

# Реалистичный тест с тегами
SENTRY_DSN=xxx npx tsx poc/test-sentry-realistic.ts
```
