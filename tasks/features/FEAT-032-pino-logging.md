# FEAT-032: Pino Structured Logging

**Статус:** PENDING
**Приоритет:** P1
**Зависимости:** Нет
**Блокирует:** Repo Split (Фаза 3)

---

## Цель

Единая система структурированного логирования для всех модулей (core, facade, telegram) с requestId correlation.

---

## Текущее состояние

| Модуль | Pino | console.* | requestId |
|--------|------|-----------|-----------|
| telegram-bot | ✅ `logger.ts` | — | ❌ |
| facade | ❌ | 24 вызова | ❌ |
| core | ❌ | ? | ❌ |

---

## Scope

### 1. Shared Logger (`src/shared/logger.ts`)

```typescript
// Factory для создания logger с service name
export function createLogger(service: string): Logger

// Child logger с requestId для correlation
export function createRequestLogger(
  baseLogger: Logger,
  requestId: string,
  userId?: string
): Logger
```

**Конфигурация:**
- Level: `LOG_LEVEL` env (default: `info`)
- Dev: pino-pretty (colorize)
- Prod: JSON stdout
- Redaction: password, token, apiKey

### 2. Telegram Bot

- [x] `logger.ts` уже есть (перенести в shared)
- [ ] Генерировать `requestId` в handlers
- [ ] Передавать `requestId` в MCP params
- [ ] ~5 файлов, ~20 строк

### 3. Facade

- [ ] Заменить 24 `console.*` на `logger.*`
- [ ] Читать `requestId` из MCP params
- [ ] Child logger в BaseTool
- [ ] ~10 файлов, ~40 строк

### 4. Core

- [ ] Создать `src/core/logger.ts`
- [ ] Логировать tRPC methods (INFO)
- [ ] Логировать slow queries >500ms (WARN)
- [ ] ~3 файла, ~15 строк

---

## Принцип логирования

**Логируй ГРАНИЦЫ, не внутренности:**

| Level | Что логировать | Где |
|-------|----------------|-----|
| INFO | User action, tool start/end, API call | Границы модулей |
| WARN | Slow query, rate limit, retry | Проблемы |
| ERROR | Exceptions, failures | Ошибки |
| DEBUG | Cache hit/miss, internal state | Отладка (off в prod) |

**Обязательные поля:**
- `requestId` — correlation между модулями
- `userId` — кто делает запрос
- `durationMs` — сколько заняло

---

## Как будем использовать логи

**Claude Code workflow:**
1. Получаем feedback/error
2. Ищем по requestId: `docker logs facade | jq 'select(.requestId == "abc")'`
3. Видим полный trace запроса через все модули
4. Определяем причину

**Production:**
- JSON в stdout → Railway logs
- Поиск через Railway UI или CLI

---

## Acceptance Criteria

- [ ] `src/shared/logger.ts` с factory functions
- [ ] Telegram: requestId генерируется и передаётся
- [ ] Facade: 0 console.* вызовов
- [ ] Core: slow queries логируются
- [ ] requestId прокидывается telegram → facade → core
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors

---

## Оценка

**LOC:** ~80
**Файлов:** ~20
**Время:** 2-3 часа
