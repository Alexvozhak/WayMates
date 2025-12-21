# FEAT-033: Sentry Error Monitoring

**Статус:** PENDING
**Приоритет:** P0
**Зависимости:** Нет
**Блокирует:** Production Deploy (Фаза 7)

---

## Цель

Error monitoring с Telegram alerts для всех модулей. Один Sentry Organization, три Projects, один Telegram чат для alerts.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                  Sentry Organization: waymates              │
├─────────────────────────────────────────────────────────────┤
│  Project: waymates-telegram  ──┐                            │
│  Project: waymates-facade    ──┼──▶ Telegram Chat (alerts)  │
│  Project: waymates-core      ──┘                            │
└─────────────────────────────────────────────────────────────┘
```

**Почему 3 проекта:**
- Facade ошибки возвращаются как JSON (Result<T, E>), не throw
- Каждый модуль — отдельный процесс/контейнер
- Разные DSN для разделения ошибок

---

## Scope

### 1. Shared Init (`src/shared/sentry.ts`)

```typescript
export function initSentry(dsn: string, service: string): void {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    serverName: service,
  });
}

export { Sentry };
```

### 2. Telegram Bot

```typescript
// index.ts
initSentry(env.SENTRY_DSN, 'telegram-bot');

// bot.ts — в существующий bot.catch()
bot.catch((error) => {
  Sentry.captureException(error.error);
  // ... existing handling
});
```

**LOC:** ~10

### 3. Facade

```typescript
// index.ts
initSentry(env.SENTRY_DSN, 'facade');

// base-tool.ts — в catch block
catch (error) {
  Sentry.captureException(error, {
    tags: { tool: this.name },
  });
  return err(this.handleError(error));
}
```

**LOC:** ~15

### 4. Core

```typescript
// index.ts
initSentry(env.SENTRY_DSN, 'core');

// tRPC error handler или database-context
Sentry.captureException(error, {
  tags: { method: methodName },
});
```

**LOC:** ~10

---

## Sentry UI Setup (инструкция)

### Шаг 1: Создать Organization + Projects (5 мин)

1. https://sentry.io → Sign Up (GitHub)
2. Create Organization: `waymates`
3. Create 3 Projects (Node.js):
   - `waymates-telegram`
   - `waymates-facade`
   - `waymates-core`
4. Скопировать DSN каждого проекта

### Шаг 2: Telegram Alerts Bot (5 мин)

1. Sentry → Settings → Integrations
2. Найти "Telegram Alerts Bot" → Install
3. Авторизовать через Telegram
4. Выбрать чат/группу для alerts

### Шаг 3: Alert Rules (10 мин)

Для каждого project:
1. Sentry → Alerts → Create Alert Rule
2. Trigger: "A new issue is created"
3. Action: "Send a Telegram notification"
4. Save

---

## Environment Variables

```bash
# .env.telegram
SENTRY_DSN=https://xxx@sentry.io/telegram-project-id

# .env.facade
SENTRY_DSN=https://xxx@sentry.io/facade-project-id

# .env.core
SENTRY_DSN=https://xxx@sentry.io/core-project-id
```

---

## Acceptance Criteria

- [ ] Sentry Organization создан
- [ ] 3 Projects созданы с DSN
- [ ] Telegram Alerts Bot подключен
- [ ] Alert Rules настроены для всех проектов
- [ ] `src/shared/sentry.ts` создан
- [ ] `initSentry()` вызывается в каждом модуле
- [ ] `captureException()` в критических catch blocks
- [ ] Test: бросить ошибку → получить alert в Telegram
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors

---

## Оценка

**LOC:** ~40
**Файлов:** ~5
**Время:** 1-2 часа (код) + 20 мин (Sentry UI)
