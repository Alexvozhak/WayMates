# FEAT-032: Pino Structured Logging

**Статус:** ✅ DONE
**Приоритет:** P1
**Зависимости:** Нет
**Блокирует:** Repo Split (Фаза 3)
**Реализовано:** 2025-12-22

---

## Цель

Единая система структурированного логирования для всех модулей (core, facade, telegram) с requestId correlation.

---

## Реализовано

### 1. Shared Env Architecture (`src/shared/env/`)

```typescript
// base.ts — общие переменные для всех модулей
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

// utils.ts — factory для создания env loader
export function createEnvLoader<T>(schema: T, serviceName: string): () => z.infer<T>
```

**Модули расширяют базовую схему:**
- `telegram-bot/env.ts` → `baseEnvSchema.extend({ TELEGRAM_BOT_TOKEN, ... })`
- `facade/env.ts` → `baseEnvSchema.extend({ REDIS_HOST, CORE_API_URL, ... })`
- `core/env.ts` → `baseEnvSchema.extend({ NEO4J_URI, CORE_PORT, ... })` (NEW)

### 2. Shared Logger (`src/shared/logger.ts`)

```typescript
export function createLogger(service: ServiceName, config: LoggerConfig): Logger
export function createRequestLogger(baseLogger: Logger, fields: RequestFields): Logger
```

**Конфигурация:**
- Level: `LOG_LEVEL` env (default: `info`)
- Dev: pino-pretty (colorize)
- Prod: JSON stdout
- Redaction: password, token, apiKey

### 3. Module Loggers

| Модуль | Logger Singleton | console.* |
|--------|------------------|-----------|
| telegram-bot | `logger-instance.ts` | ✅ 0 |
| facade | `logger.ts` | ✅ 0 |
| core | `logger.ts` | ✅ 0 |

---

## Acceptance Criteria

- [x] `src/shared/logger.ts` с factory functions
- [x] `src/shared/env/` с base schema + createEnvLoader
- [x] Facade: 0 console.* вызовов
- [x] Core: env.ts создан, console.* заменены
- [x] Telegram: logger мигрирован в shared
- [x] `npm run lint` — 0 errors
- [x] `npx tsc --noEmit` — 0 errors
- [x] vitest.config.ts: добавлен `env: loadEnv()` в integration-* проекты

---

## Отложено (P1)

- [ ] requestId генерация в telegram handlers
- [ ] requestId propagation через MCP params
- [ ] slow queries logging (>500ms) в Core

---

## Статистика

**LOC:** ~122 (новый код)
**Файлов:** 8 новых + 16 обновлённых
**console.* заменено:** ~28 вызовов
