# Production Readiness: Глубокий анализ критических компонентов

**Дата:** 2025-12-08
**Версия:** Детальный разбор P0/P1 компонентов
**Branch:** `feature/telegram-bot`

---

## Содержание

1. [Request Timeout - Глубокий анализ](#1-request-timeout---глубокий-анализ)
2. [Conversation State Cleanup - Детальный разбор](#2-conversation-state-cleanup---детальный-разбор)
3. [Health Check - Системный подход](#3-health-check---системный-подход)
4. [Graceful Shutdown - OOP vs Functional](#4-graceful-shutdown---oop-vs-functional)
5. [Webhook Secret Validation - Полный разбор](#5-webhook-secret-validation---полный-разбор)

---

## 1. Request Timeout - Глубокий анализ

### 🔍 Текущая проблема

```typescript
// src/telegram-bot/services/mcp-client.ts:163
async function sendMcpRequest(...): Promise<McpToolResult> {
  const response = await fetch(facadeUrl, {  // ← НЕТ TIMEOUT!
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... }),
  });
  // ...
}
```

**Что происходит БЕЗ timeout:**

1. **User отправляет:** `/by_target Senior Developer в США`
2. **Bot → Facade MCP:** HTTP POST запрос
3. **Facade → Neo4j:** Cypher query (например, сложный поиск с DTW)
4. **Neo4j тормозит:** Query выполняется 5 минут (плохой план, большой граф, нет индекса)
5. **Facade висит:** Ждёт ответа от Neo4j
6. **Bot висит:** `fetch()` ждёт бесконечно
7. **User видит:** "typing..." 5 минут, потом ничего или ошибка

**Retry НЕ помогает:**

```typescript
// Строка 116: retry срабатывает ТОЛЬКО после завершения fetch
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const result = await attemptMcpRequest(...);  // ← Если fetch висит, retry не запустится!
  // ...
}
```

Retry механизм работает только для завершённых запросов с ошибкой. Если `fetch()` висит бесконечно, retry никогда не сработает.

---

### 🛠️ Альтернативы решений

#### **Вариант 1: AbortController (Native, рекомендуется)**

**Плюсы:**
- ✅ Native в Node.js 18+ (нет зависимостей)
- ✅ Поддерживается `fetch()` из коробки
- ✅ Чистая отмена запроса (не маскирование)
- ✅ Стандарт Web API
- ✅ Реально отменяет HTTP request (освобождает ресурсы)

**Минусы:**
- ❌ Немного verbose код
- ❌ Нужен manual cleanup (abort controller)

**Код:**

```typescript
// src/telegram-bot/services/mcp-client.ts

const REQUEST_TIMEOUT_MS = 30000; // 30 секунд

async function sendMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(facadeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: { name: toolName, arguments: params },
      }),
      signal: controller.signal,  // ← AbortController signal
    });

    clearTimeout(timeoutId);  // ← Cleanup

    if (!response.ok) {
      throw new McpClientError(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const jsonData: unknown = await response.json();
    const data = mcpResponseSchema.parse(jsonData);

    if (data.error) {
      throw new McpClientError(`MCP error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new McpClientError("No result in MCP response");
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);  // ← Cleanup в catch тоже!

    if (error instanceof Error && error.name === 'AbortError') {
      throw new McpClientError(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  }
}
```

**User experience:**

```
User: /by_target Developer
Bot: 🔍 Ищу...
[30 секунд проходит]
Bot: ❌ Поиск занял слишком много времени. Попробуйте упростить запрос или повторите позже.
```

**Локализация:**

```fluent
# src/telegram-bot/locales/ru.ftl
mcp-timeout = ⏱️ Поиск занял слишком много времени. Попробуйте упростить запрос или повторите позже.

# src/telegram-bot/locales/en.ftl
mcp-timeout = ⏱️ Search took too long. Try simplifying your query or retry later.
```

---

#### **Вариант 2: p-timeout (Библиотека)**

**Плюсы:**
- ✅ Простой API
- ✅ TypeScript-friendly
- ✅ Работает с любыми Promise

**Минусы:**
- ❌ Дополнительная зависимость (3.2 kB)
- ❌ НЕ отменяет сам fetch (маскирует таймаут, но fetch продолжает)
- ❌ **Memory leak:** fetch продолжает висеть в фоне

**Код:**

```typescript
import pTimeout from 'p-timeout';

async function sendMcpRequest(...): Promise<McpToolResult> {
  const fetchPromise = fetch(facadeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... }),
  });

  try {
    const response = await pTimeout(fetchPromise, {
      milliseconds: 30000,
      message: 'MCP request timeout',
    });

    // ...rest of processing
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new McpClientError('Request timeout after 30s');
    }
    throw error;
  }
}
```

**Проблема:**

```
User: /by_target Developer
[30s timeout срабатывает]
Bot: ❌ Timeout
[fetch ПРОДОЛЖАЕТ висеть в фоне!]  ← Memory leak
[Через 5 минут Neo4j отвечает]
[Никто не обрабатывает ответ]
[Соединение висит открытым]
[Накапливаются висящие connections]
```

**Почему это плохо:**

- 🔴 Каждый висящий fetch занимает память
- 🔴 Открытые TCP connections не закрываются
- 🔴 Node.js event loop загружен
- 🔴 Через N запросов → OOM (Out of Memory)

---

#### **Вариант 3: Promise.race (Manual)**

**Плюсы:**
- ✅ Нет зависимостей
- ✅ Простой концепт

**Минусы:**
- ❌ Та же проблема что у p-timeout (НЕ отменяет fetch)
- ❌ Verbose код
- ❌ Memory leak

**Код:**

```typescript
async function sendMcpRequest(...): Promise<McpToolResult> {
  const fetchPromise = fetch(facadeUrl, { ... });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), 30000);
  });

  try {
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    // ...
  } catch (error) {
    // ...
  }
}
```

**Та же проблема:** fetch не отменяется, продолжает висеть в фоне.

---

#### **Вариант 4: Axios с timeout**

**Плюсы:**
- ✅ Built-in timeout
- ✅ Автоматическая отмена запроса
- ✅ Богатый функционал (interceptors, retry, etc.)
- ✅ Хорошо документирован

**Минусы:**
- ❌ Тяжёлая зависимость (500+ kB vs fetch 0 kB)
- ❌ Нужно переписывать весь MCP client
- ❌ Overkill для простого HTTP POST

**Код:**

```typescript
import axios from 'axios';

async function sendMcpRequest(...): Promise<McpToolResult> {
  const response = await axios.post(facadeUrl, {
    jsonrpc: "2.0",
    id: ++requestId,
    method: "tools/call",
    params: { name: toolName, arguments: params },
  }, {
    timeout: 30000,  // ← Built-in timeout
    headers: { "Content-Type": "application/json" },
  });

  if (response.data.error) {
    throw new McpClientError(`MCP error: ${response.data.error.message}`);
  }

  return response.data.result;
}
```

**Установка:**

```bash
npm install axios
# + добавляет ~500kB к bundle size
```

---

#### **Вариант 5: Custom wrapper с AbortController (Рекомендуется)**

**Плюсы:**
- ✅ Reusable для всех fetch вызовов
- ✅ Type-safe
- ✅ Чистый код в месте использования
- ✅ Нет зависимостей
- ✅ Реальная отмена запроса

**Код:**

```typescript
// src/telegram-bot/utils/fetch-with-timeout.ts

export class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchTimeoutError(`Request timeout after ${timeoutMs}ms`);
    }

    throw error;
  }
}
```

**Использование:**

```typescript
// src/telegram-bot/services/mcp-client.ts
import { fetchWithTimeout, FetchTimeoutError } from "../utils/fetch-with-timeout.js";

async function sendMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  try {
    const response = await fetchWithTimeout(
      facadeUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++requestId,
          method: "tools/call",
          params: { name: toolName, arguments: params },
        }),
      },
      30000  // 30s timeout
    );

    if (!response.ok) {
      throw new McpClientError(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const jsonData: unknown = await response.json();
    const data = mcpResponseSchema.parse(jsonData);

    if (data.error) {
      throw new McpClientError(`MCP error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new McpClientError("No result in MCP response");
    }

    return data.result;
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      throw new McpClientError('MCP request timeout');
    }
    throw error;
  }
}
```

**Преимущества:**

1. ✅ Переиспользуемый wrapper
2. ✅ Чистый код в MCP client
3. ✅ Легко тестировать
4. ✅ Можно использовать для других fetch вызовов (Whisper API, OpenAI, etc.)

---

### 📊 Сравнительная таблица

| Решение | Зависимости | Отменяет запрос | Memory safe | Простота | Bundle size | Рекомендация |
|---------|-------------|-----------------|-------------|----------|-------------|--------------|
| **AbortController (inline)** | 0 | ✅ Да | ✅ Да | ⭐⭐⭐⭐ | 0 kB | ⭐⭐⭐⭐ |
| **Custom wrapper** | 0 | ✅ Да | ✅ Да | ⭐⭐⭐⭐⭐ | 0 kB | ⭐⭐⭐⭐⭐ **BEST** |
| **p-timeout** | 1 (3kB) | ❌ Нет | ❌ Leak | ⭐⭐⭐⭐⭐ | +3 kB | ⭐⭐ |
| **Promise.race** | 0 | ❌ Нет | ❌ Leak | ⭐⭐⭐ | 0 kB | ⭐⭐ |
| **axios** | 1 (500kB) | ✅ Да | ✅ Да | ⭐⭐⭐⭐⭐ | +500 kB | ⭐⭐⭐ |

---

### 🎯 Рекомендация для WayMates

**Используйте Вариант 5 (Custom wrapper с AbortController):**

**Причины:**

1. ✅ Нет зависимостей (важно для минимального bundle)
2. ✅ Чистая отмена запроса (освобождает ресурсы)
3. ✅ Reusable для всех fetch вызовов проекта
4. ✅ Type-safe с кастомными error классами
5. ✅ Простой в тестировании (можно mock timeout)
6. ✅ Следует Web API стандартам

**Время реализации:** ~15 минут

**Приоритет:** 🔴 **P0 (блокер)** - должно быть реализовано до production

---

### ⚠️ Что будет БЕЗ timeout?

#### **Сценарий 1: Neo4j медленный query**

```
User: /by_target Developer в США
Bot: 🔍 Ищу...
[Neo4j query 10 минут из-за missing index]
User: *ждёт 10 минут*
User: *закрывает Telegram в бешенстве*
User: *пишет 1-star review: "Бот не работает!"*
```

#### **Сценарий 2: Network partition**

```
User: /by_target Developer
Bot: 🔍 Ищу...
[Network между Bot и Facade отваливается]
[fetch висит до TCP timeout (2-5 минут)]
User: *не получает ответа вообще*
[Bot process висит на этом запросе]
```

#### **Сценарий 3: DoS атака**

```
Attacker: /by_target test [x1000 запросов параллельно]
[Все 1000 fetch висят без timeout]
[Node.js процесс:
  - Event loop blocked
  - Memory usage растёт
  - OOM (out of memory)]
[Bot падает полностью]
[Все users не могут использовать бот]
```

#### **Сценарий 4: Cascade failure**

```
Neo4j slow query (1 min)
  ↓
Facade медленный (накапливаются запросы)
  ↓
Bot медленный (все handlers блокированы)
  ↓
Users видят timeout (начинают retry)
  ↓
Ещё больше запросов к Facade
  ↓
Facade падает (too many connections)
  ↓
Bot не может обрабатывать НИЧЕГО
  ↓
Complete service outage
```

**Восстановление:** Нужен manual restart всех сервисов + очистка queue.

---

## 2. Conversation State Cleanup - Детальный разбор

### 🔍 Текущее состояние

**Структура session:**

```typescript
// src/telegram-bot/types.ts:20
export type MySessionData = {
  sessionId: string;        // Facade session ID
  hasStory: boolean;        // Флаг наличия истории
  token: string;            // Facade auth token
  pendingAction?: PendingAction;  // Ожидающее действие (story/by_target/etc)
};
```

**Redis конфигурация:**

```typescript
// src/telegram-bot/bot.ts:60
const storage = new RedisAdapter<MySessionData>({
  instance: redis
  // ← НЕТ TTL!
});
```

**Как выглядит в Redis:**

```redis
# Формат ключа: "session:<chat_id>"
> KEYS "session:*"
1) "session:123456789"
2) "session:987654321"
3) "session:111222333"

> GET "session:123456789"
"{\"sessionId\":\"sess_abc123\",\"hasStory\":true,\"token\":\"tok_xyz\",\"pendingAction\":\"by_target\"}"

> TTL "session:123456789"
-1  # ← -1 означает "нет TTL, живёт вечно"
```

---

### 🐛 Проблема: Memory Leak

**Сценарий развития:**

```
Day 1:   100 users → 100 sessions в Redis
Day 7:   500 users → 500 sessions в Redis
Day 30:  2000 users → 2000 sessions в Redis

[50 users удалили бот]
[300 users неактивны 2+ месяца]
[Sessions НЕ удаляются автоматически]

Day 60:  5000 users → 5000 sessions
Day 90:  10000 users → 10000 sessions в Redis

Redis memory usage:
- 10000 sessions × ~200 bytes = ~2 MB (сами данные)
- + Redis overhead (~50%) = ~3 MB
- + Неактивные sessions (70%) = wasteful
```

**Пример неактивного session:**

```redis
> GET "session:999888777"
{
  "sessionId": "sess_old_2024_01_15",
  "hasStory": true,
  "token": "tok_expired",
  "pendingAction": "by_target"  # ← User установил 3 месяца назад и забыл!
}

> TTL "session:999888777"
-1  # ← Живёт вечно, хотя user не заходил 3 месяца
```

---

### 📋 Что сейчас сбрасывается и что нет

#### ✅ Что сбрасывается АВТОМАТИЧЕСКИ:

**НИЧЕГО!** Без TTL ничего не сбрасывается автоматически.

#### ❌ Что НЕ сбрасывается (проблемные данные):

| Поле | Проблема | Последствия |
|------|----------|-------------|
| **sessionId** | Живёт вечно | Facade session может истечь, но bot хранит старый ID |
| **token** | Живёт вечно | Security risk: старые токены в Redis |
| **hasStory** | Устаревает | User мог удалить историю в другом клиенте, bot не знает |
| **pendingAction** | Живёт пока session жив | User нажал `/story` 2 месяца назад, забыл → состояние "висит" |

#### 🔄 Что ДОЛЖНО сбрасываться:

| Поле | Рекомендуемый TTL | Обоснование |
|------|-------------------|-------------|
| **Весь session** | 7 дней | Неактивные users не занимают память |
| **pendingAction** | 1 час | User забыл → автоматическая очистка |
| **hasStory** | Refresh каждый запрос | Синхронизация с Facade |
| **sessionId/token** | 7 дней | Re-authentication при возвращении |

---

### 🛠️ Решение 1: Global TTL (Простое)

**Подход:** Все sessions живут N часов с момента последнего обновления.

**Код:**

```typescript
// src/telegram-bot/bot.ts:60
const storage = new RedisAdapter<MySessionData>({
  instance: redis,
  ttl: 604800,  // 7 дней (в секундах)
});
```

**Как работает:**

```
User пишет /start
→ Session создаётся: SET session:123 {...} EX 604800
→ TTL = 7 дней

User пишет /by_target через 3 дня
→ Session обновляется: SET session:123 {...} EX 604800
→ TTL сбрасывается = 7 дней (снова!)

User не пишет 7 дней
→ Redis автоматически удаляет ключ
→ Session пропал

User пишет снова через 8 дней
→ Session не найден
→ bot.use(session({ initial: ... })) создаёт новый
→ refreshSession вызывается (register_telegram)
→ Новый sessionId, token, hasStory
```

**Плюсы:**

- ✅ **Простая настройка:** 1 строка кода
- ✅ **Автоматическая очистка:** Redis делает всё сам
- ✅ **Защита от memory leak:** Неактивные sessions удаляются
- ✅ **Справедливый TTL:** Активные users продлевают session автоматически

**Минусы:**

- ❌ **Потеря sessionId/token после 7 дней:** User должен пройти re-authentication
- ❌ **Потеря hasStory флага:** Придётся заново проверять
- ❌ **Нет гибкости:** Все данные живут одинаково долго

**User Experience:**

```
User активный (пишет каждый день):
→ Session никогда не истекает (TTL продлевается)
→ UX: отлично ✅

User возвращается через неделю:
→ Session удалён
→ Bot: "Добро пожаловать! Давайте авторизуемся"
→ UX: приемлемо ⚠️

User возвращается через 2 недели:
→ Session удалён
→ Bot повторная авторизация
→ UX: приемлемо ⚠️
```

---

### 🛠️ Решение 2: Selective TTL через Middleware (Умное)

**Подход:** Разные TTL для разных типов данных.

**Новая структура session:**

```typescript
// src/telegram-bot/types.ts
export type MySessionData = {
  // Persistent data (долгоживущие, TTL = 7 дней)
  sessionId: string;
  token: string;
  hasStory: boolean;

  // Temporary data (короткоживущие, TTL = 1 час)
  pendingAction?: PendingAction;
  pendingActionSetAt?: number;  // ← Timestamp когда установлено
};
```

**Middleware для автоматической очистки:**

```typescript
// src/telegram-bot/middlewares/session-cleanup.ts

const PENDING_ACTION_TTL_MS = 3600_000; // 1 час

export async function sessionCleanupMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  // Проверяем pendingAction TTL
  if (ctx.session.pendingAction && ctx.session.pendingActionSetAt) {
    const age = Date.now() - ctx.session.pendingActionSetAt;

    if (age > PENDING_ACTION_TTL_MS) {
      // Очищаем устаревшее действие
      delete ctx.session.pendingAction;
      delete ctx.session.pendingActionSetAt;

      // Опционально: уведомить user
      await ctx.reply(ctx.t("pending-action-expired"));
    }
  }

  await next();
}
```

**Обновить pending-actions.ts:**

```typescript
// src/telegram-bot/services/pending-actions.ts
export function setPendingAction(ctx: BotContext, action: PendingAction): void {
  ctx.session.pendingAction = action;
  ctx.session.pendingActionSetAt = Date.now();  // ← Сохраняем timestamp
}

export function clearPendingAction(ctx: BotContext): void {
  delete ctx.session.pendingAction;
  delete ctx.session.pendingActionSetAt;  // ← Удаляем и timestamp
}
```

**Интеграция в bot.ts:**

```typescript
// src/telegram-bot/bot.ts
import { sessionCleanupMiddleware } from "./middlewares/session-cleanup.js";

export function createBot(token: string, services: BotServices): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // ...existing middleware (i18n, hydrate)...

  const storage = new RedisAdapter<MySessionData>({
    instance: redis,
    ttl: 604800,  // 7 дней для всех persistent данных
  });

  bot.use(session({
    initial: () => ({
      sessionId: "",
      hasStory: false,
      token: ""
    }),
    storage
  }));

  bot.use(sessionCleanupMiddleware);  // ← Очистка pendingAction автоматически

  // ...rest of setup
}
```

**Локализация:**

```fluent
# src/telegram-bot/locales/ru.ftl
pending-action-expired = ⏱️ Ваше предыдущее действие истекло. Пожалуйста, выберите команду заново.

# src/telegram-bot/locales/en.ftl
pending-action-expired = ⏱️ Your previous action expired. Please select a command again.
```

**Плюсы:**

- ✅ **Гибкость:** Разные TTL для разных данных
- ✅ **pendingAction очищается через 1 час:** Автоматически
- ✅ **sessionId/token живут 7 дней:** Меньше re-authentication
- ✅ **User notification:** Понятно почему очистилось

**Минусы:**

- ❌ **Больше кода:** Нужен middleware
- ❌ **Complexity:** 2 механизма TTL (Redis global + middleware selective)

**User Experience:**

```
User нажал /story, отвлёкся на 2 часа, вернулся:
→ pendingAction очищен
→ User вводит текст
→ Bot: "⏱️ Ваше действие истекло. Выберите команду заново"
→ UX: отлично ✅ (понятная обратная связь)

User активный, пишет каждый день:
→ sessionId/token живут вечно (TTL продлевается)
→ UX: отлично ✅

User возвращается через неделю:
→ Session удалён (global TTL)
→ Re-authentication
→ UX: приемлемо ⚠️
```

---

### 🛠️ Решение 3: Redis per-field TTL (Advanced)

**Подход:** Использовать Redis Hash + отдельные TTL для каждого поля.

**Проблема:** grammY `RedisAdapter` НЕ поддерживает per-field TTL из коробки.

**Решение:** Создать отдельное хранилище для temporary данных.

**Код:**

```typescript
// src/telegram-bot/services/temporary-session-storage.ts
import type { Redis } from "ioredis";
import type { PendingAction } from "../types.js";

export class TemporarySessionStorage {
  constructor(private redis: Redis) {}

  async setPendingAction(chatId: number, action: PendingAction): Promise<void> {
    const key = `pending:${chatId}`;
    await this.redis.setex(key, 3600, action);  // TTL 1 час
  }

  async getPendingAction(chatId: number): Promise<PendingAction | null> {
    const key = `pending:${chatId}`;
    return await this.redis.get(key) as PendingAction | null;
  }

  async clearPendingAction(chatId: number): Promise<void> {
    const key = `pending:${chatId}`;
    await this.redis.del(key);
  }
}
```

**Обновить BotServices:**

```typescript
// src/telegram-bot/types.ts
export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig;
  tempStorage: TemporarySessionStorage;  // ← Добавить
};
```

**Использование:**

```typescript
// src/telegram-bot/services/pending-actions.ts
export async function setPendingAction(
  ctx: BotContext,
  action: PendingAction
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Сохраняем в отдельное Redis key с TTL
  await ctx.services.tempStorage.setPendingAction(chatId, action);

  // НЕ сохраняем в ctx.session!
}

export async function getPendingAction(
  ctx: BotContext
): Promise<PendingAction | undefined> {
  const chatId = ctx.chat?.id;
  if (!chatId) return undefined;

  const action = await ctx.services.tempStorage.getPendingAction(chatId);
  return action ?? undefined;
}

export async function clearPendingAction(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await ctx.services.tempStorage.clearPendingAction(chatId);
}
```

**Интеграция:**

```typescript
// src/telegram-bot/index.ts
import { TemporarySessionStorage } from "./services/temporary-session-storage.js";

const redis = new Redis(redisUrl);
const tempStorage = new TemporarySessionStorage(redis);

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  // ...existing services,
  tempStorage,
});
```

**Плюсы:**

- ✅ **Автоматический TTL:** Redis делает всё сам
- ✅ **Чистое разделение:** Persistent vs temporary данные
- ✅ **Меньше кода в middleware:** Логика TTL в Redis
- ✅ **Точный TTL:** Именно 1 час, не "до следующего update"

**Минусы:**

- ❌ **Больше Redis calls:** Каждый getPendingAction → Redis query
- ❌ **Нужно передавать tempStorage:** В services
- ❌ **Complexity:** 2 хранилища (session storage + temp storage)

---

### 📊 Сравнение решений

| Решение | Сложность | Memory safe | User UX | Гибкость | Рекомендация |
|---------|-----------|-------------|---------|----------|--------------|
| **Global TTL (7 дней)** | ⭐ | ✅ Да | ⚠️ OK | ⭐⭐ | ⭐⭐⭐⭐ **START HERE** |
| **Selective TTL (middleware)** | ⭐⭐⭐ | ✅ Да | ✅ Отлично | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ **BEST** |
| **Redis per-field TTL** | ⭐⭐⭐⭐ | ✅ Да | ✅ Отлично | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ Advanced |

---

### 🎯 Рекомендация для WayMates

**Фаза 1 (немедленно):** Используйте **Решение 1 (Global TTL 7 дней)**

**Причины:**

1. ✅ **Быстро:** 1 строка кода
2. ✅ **Эффективно:** Решает memory leak
3. ✅ **Безопасно:** Redis встроенная функция

**Код:**

```typescript
// src/telegram-bot/bot.ts:60
const storage = new RedisAdapter<MySessionData>({
  instance: redis,
  ttl: 604800,  // ← ДОБАВИТЬ ЭТУ СТРОКУ (7 дней)
});
```

**Время реализации:** 2 минуты
**Приоритет:** 🔴 **P0 (блокер)** - критично для production

---

**Фаза 2 (когда появится больше temporary данных):** Переходите на **Решение 2 (Selective TTL)**

**Когда переходить:**

- ⏰ Когда добавите больше temporary state (например, multi-step forms)
- ⏰ Когда users начнут жаловаться на "expired действия"
- ⏰ Когда захотите более гибкий контроль

---

### 📈 Мониторинг session cleanup

**Добавьте метрики:**

```typescript
// src/telegram-bot/middlewares/session-cleanup.ts

let cleanedSessionsCount = 0;

export async function sessionCleanupMiddleware(...) {
  if (ctx.session.pendingAction && ctx.session.pendingActionSetAt) {
    const age = Date.now() - ctx.session.pendingActionSetAt;

    if (age > PENDING_ACTION_TTL_MS) {
      cleanedSessionsCount++;
      logger.info(
        { chatId: ctx.chat?.id, action: ctx.session.pendingAction, ageHours: age / 3600000 },
        'Cleaned expired pending action'
      );

      delete ctx.session.pendingAction;
      delete ctx.session.pendingActionSetAt;
    }
  }

  await next();
}

export function getCleanedSessionsCount(): number {
  return cleanedSessionsCount;
}
```

**Health endpoint:**

```typescript
app.get("/health", async (req, res) => {
  const health = await healthChecker.check();

  res.json({
    ...health,
    metrics: {
      cleanedSessions: getCleanedSessionsCount(),
    },
  });
});
```

---

## 3. Health Check - Системный подход

### 🔍 Текущая проблема

Проверка только Redis недостаточна. Нужно проверять **все критические зависимости**.

**Критические зависимости WayMates Bot:**

1. ✅ **Redis** - session storage (планируется проверять)
2. ❌ **Facade MCP** - главный сервис (НЕ проверяется!)
3. ❌ **OpenAI API** - NLP parsing (НЕ проверяется!)
4. ❌ **Groq API** - formatters (НЕ проверяется!)

**Проблема:**

```
Scenario: Facade MCP падает
→ Redis работает ✅
→ Health check возвращает: 200 OK
→ Kubernetes думает: "всё ок, не рестартую"
→ Bot не может обрабатывать команды (все падают с MCP error)
→ Users получают ошибки
→ Health check ВСЁ ЕЩЁ показывает OK!
```

---

### 🛠️ Правильный Health Check

**Архитектура:**

```
/health              → Полная проверка всех компонентов (для мониторинга)
/health/liveness     → Процесс жив? (для k8s liveness probe)
/health/readiness    → Готов принимать трафик? (для k8s readiness probe)
```

**Код:**

```typescript
// src/telegram-bot/health.ts

import type { Redis } from "ioredis";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type ComponentHealth = {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
};

export type HealthCheckResult = {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  components: {
    redis: ComponentHealth;
    facade: ComponentHealth;
    openai: ComponentHealth;
    groq: ComponentHealth;
  };
};

export class HealthChecker {
  constructor(
    private redis: Redis,
    private facadeMcpUrl: string,
    private openaiApiKey: string,
    private groqApiKey: string,
  ) {}

  async check(): Promise<HealthCheckResult> {
    // Проверяем ВСЕ компоненты параллельно
    const [redisHealth, facadeHealth, openaiHealth, groqHealth] = await Promise.allSettled([
      this.checkRedis(),
      this.checkFacade(),
      this.checkOpenAI(),
      this.checkGroq(),
    ]);

    const components = {
      redis: redisHealth.status === "fulfilled"
        ? redisHealth.value
        : { status: "unhealthy" as const, message: "Check failed" },
      facade: facadeHealth.status === "fulfilled"
        ? facadeHealth.value
        : { status: "unhealthy" as const, message: "Check failed" },
      openai: openaiHealth.status === "fulfilled"
        ? openaiHealth.value
        : { status: "degraded" as const, message: "Check failed" },
      groq: groqHealth.status === "fulfilled"
        ? groqHealth.value
        : { status: "degraded" as const, message: "Check failed" },
    };

    const overallStatus = this.determineOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components,
    };
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      await this.redis.ping();
      const latencyMs = Date.now() - start;

      return {
        status: latencyMs < 100 ? "healthy" : "degraded",
        latencyMs,
        message: this.redis.status,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkFacade(): Promise<ComponentHealth> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      // Проверяем /health endpoint Facade (если есть)
      const healthUrl = this.facadeMcpUrl.replace("/mcp", "/health");
      const response = await fetch(healthUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return {
          status: "unhealthy",
          latencyMs,
          message: `HTTP ${response.status}`,
        };
      }

      return {
        status: latencyMs < 1000 ? "healthy" : "degraded",
        latencyMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          status: "unhealthy",
          message: "Timeout (5s)",
        };
      }

      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkOpenAI(): Promise<ComponentHealth> {
    // НЕ делаем реальный API call (стоит денег!)
    // Проверяем только доступность API endpoint
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${this.openaiApiKey}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      // 401 - invalid key, но API доступно
      // 200 - всё ок
      const isAccessible = response.status === 200 || response.status === 401;

      return {
        status: isAccessible ? "healthy" : "degraded",
        latencyMs,
        message: isAccessible ? "API accessible" : `HTTP ${response.status}`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // OpenAI недоступен - НЕ критично (bot может работать без NLP)
      return {
        status: "degraded",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkGroq(): Promise<ComponentHealth> {
    // Аналогично OpenAI
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${this.groqApiKey}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      const isAccessible = response.status === 200 || response.status === 401;

      return {
        status: isAccessible ? "healthy" : "degraded",
        latencyMs,
        message: isAccessible ? "API accessible" : `HTTP ${response.status}`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      return {
        status: "degraded",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private determineOverallStatus(
    components: Record<string, ComponentHealth>
  ): HealthStatus {
    const statuses = Object.values(components).map((c) => c.status);

    // Если Redis или Facade unhealthy → критично
    if (components.redis.status === "unhealthy" || components.facade.status === "unhealthy") {
      return "unhealthy";
    }

    // Если хотя бы один degraded → overall degraded
    if (statuses.includes("degraded")) {
      return "degraded";
    }

    return "healthy";
  }
}
```

**Использование:**

```typescript
// src/telegram-bot/index.ts
import express from "express";
import { HealthChecker } from "./health.js";

const app = express();

const healthChecker = new HealthChecker(
  redis,
  env.FACADE_MCP_URL,
  env.OPENAI_API_KEY,
  env.GROQ_API_KEY,
);

// Полная проверка всех компонентов
app.get("/health", async (req, res) => {
  const health = await healthChecker.check();

  // 200 - healthy
  // 200 - degraded (работает, но медленно)
  // 503 - unhealthy (не готов)
  const statusCode = health.status === "healthy"
    ? 200
    : health.status === "degraded"
    ? 200
    : 503;

  res.status(statusCode).json(health);
});

// Liveness probe - процесс жив?
app.get("/health/liveness", (req, res) => {
  res.status(200).json({
    status: "alive",
    uptime: process.uptime(),
  });
});

// Readiness probe - готов обрабатывать запросы?
app.get("/health/readiness", async (req, res) => {
  const health = await healthChecker.check();

  if (health.status === "unhealthy") {
    res.status(503).json({
      status: "not ready",
      reason: health.components
    });
    return;
  }

  res.status(200).json({ status: "ready" });
});

const PORT = process.env.HEALTH_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Health check listening on port ${PORT}`);
});
```

---

### 📊 Пример ответов

#### `/health` - Все компоненты здоровы

```json
{
  "status": "healthy",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "uptime": 3600.5,
  "components": {
    "redis": {
      "status": "healthy",
      "latencyMs": 2,
      "message": "ready"
    },
    "facade": {
      "status": "healthy",
      "latencyMs": 150
    },
    "openai": {
      "status": "healthy",
      "latencyMs": 450,
      "message": "API accessible"
    },
    "groq": {
      "status": "healthy",
      "latencyMs": 380,
      "message": "API accessible"
    }
  }
}
```

#### `/health` - Facade недоступен (критично!)

```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-08T10:35:00.000Z",
  "uptime": 3900.2,
  "components": {
    "redis": {
      "status": "healthy",
      "latencyMs": 3,
      "message": "ready"
    },
    "facade": {
      "status": "unhealthy",
      "message": "Timeout (5s)"
    },
    "openai": {
      "status": "healthy",
      "latencyMs": 420,
      "message": "API accessible"
    },
    "groq": {
      "status": "healthy",
      "latencyMs": 350,
      "message": "API accessible"
    }
  }
}
```

**HTTP Status:** 503 Service Unavailable

→ Kubernetes restart pod!

---

### 🎯 Kubernetes/Docker integration

```yaml
# k8s-deployment.yaml
apiVersion: v1
kind: Pod
metadata:
  name: waymates-bot
spec:
  containers:
  - name: bot
    image: waymates-bot:latest
    ports:
    - containerPort: 3001
      name: health

    # Liveness probe: рестарт если процесс мёртв
    livenessProbe:
      httpGet:
        path: /health/liveness
        port: 3001
      initialDelaySeconds: 10
      periodSeconds: 30
      timeoutSeconds: 5
      failureThreshold: 3

    # Readiness probe: не направлять трафик если не готов
    readinessProbe:
      httpGet:
        path: /health/readiness
        port: 3001
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 2
```

**Как работает:**

```
Scenario 1: Facade MCP падает
→ /health/readiness возвращает 503
→ Kubernetes: "pod не готов, не шлю трафик"
→ Другие pods продолжают обрабатывать requests
→ Facade восстанавливается
→ /health/readiness возвращает 200
→ Kubernetes: "pod готов, шлю трафик снова"

Scenario 2: Bot процесс зависает
→ /health/liveness не отвечает (timeout)
→ Kubernetes: "pod мёртв, рестартую"
→ Новый pod стартует
→ Health checks проходят
→ Kubernetes: "pod готов, шлю трафик"
```

---

### 🎯 Рекомендация для WayMates

**Реализуйте все 3 endpoint:**

1. `/health` - для monitoring dashboards (Grafana, etc.)
2. `/health/liveness` - для Kubernetes liveness probe
3. `/health/readiness` - для Kubernetes readiness probe

**Приоритет:** 🟡 **P1 (важно)** - нужно для production deployment

**Время реализации:** ~1 час

---

## 4. Graceful Shutdown - OOP vs Functional

### 🔍 Текущий код (Functional)

```typescript
// src/telegram-bot/index.ts:18
process.on("SIGTERM", () => void bot.stop());
process.on("SIGINT", () => void bot.stop());
```

**Проблема:** Не закрывает Redis connection!

**Что происходит:**

```
Kubernetes отправляет SIGTERM
→ bot.stop() вызывается
→ Bot перестаёт принимать updates
→ Redis connection ВСЁ ЕЩЁ ОТКРЫТ!
→ Процесс завершается
→ Redis видит "connection lost" (грязное закрытие)
→ Redis может потерять последние изменения в session
```

---

### 🛠️ Вариант 1: Functional (Improved)

**Код:**

```typescript
// src/telegram-bot/index.ts

import { logger } from "./logger.js";

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Timeout защита: если shutdown занимает >10s, force exit
  const shutdownTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout, forcing exit");
    process.exit(1);
  }, 10000);

  try {
    // 1. Stop accepting new updates
    logger.info("Stopping bot...");
    await bot.stop();

    // 2. Close Redis connection
    logger.info("Closing Redis connection...");
    await redis.quit();

    // 3. Close HTTP server (health check)
    if (healthServer) {
      logger.info("Closing health check server...");
      await new Promise<void>((resolve) => {
        healthServer.close(() => resolve());
      });
    }

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

// Signal handlers
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

// Prevent unhandled promise rejections from crashing
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught Exception");
  void gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Start bot
logger.info("Starting bot...");
await bot.start();
```

**Плюсы:**

- ✅ **Простой код:** Функциональный стиль
- ✅ **Timeout защита:** Не зависнет на shutdown
- ✅ **Закрывает все connections:** Redis, HTTP server
- ✅ **Логирование:** Понятно что происходит
- ✅ **Error handling:** Обрабатывает ошибки при shutdown

**Минусы:**

- ❌ **Не ООП:** Использует глобальные переменные
- ❌ **Сложно тестировать:** Нужно mock process.exit
- ❌ **Не расширяемо:** Сложно добавить новые ресурсы

---

### 🛠️ Вариант 2: OOP (Application Class)

**Архитектура:**

```
Application (class)
├── Bot (grammY)
├── Redis (ioredis)
├── HealthServer (express)
└── shutdown() method
```

**Код:**

```typescript
// src/telegram-bot/application.ts

import type { Bot } from "grammy";
import type { Redis } from "ioredis";
import type { Server } from "http";
import { logger } from "./logger.js";
import type { BotContext } from "./types.js";

export class Application {
  private shutdownInProgress = false;
  private shutdownTimeout?: NodeJS.Timeout;

  constructor(
    private bot: Bot<BotContext>,
    private redis: Redis,
    private healthServer?: Server,
  ) {
    this.setupSignalHandlers();
  }

  async start(): Promise<void> {
    logger.info("Starting application...");

    try {
      await this.bot.start();
      logger.info("Bot started successfully");
    } catch (error) {
      logger.error({ err: error }, "Failed to start bot");
      await this.shutdown();
      throw error;
    }
  }

  private setupSignalHandlers(): void {
    process.on("SIGTERM", () => this.handleSignal("SIGTERM"));
    process.on("SIGINT", () => this.handleSignal("SIGINT"));

    process.on("unhandledRejection", (reason, promise) => {
      logger.error({ reason, promise }, "Unhandled Rejection");
    });

    process.on("uncaughtException", (error) => {
      logger.error({ err: error }, "Uncaught Exception");
      void this.shutdown();
    });
  }

  private handleSignal(signal: string): void {
    logger.info(`${signal} received`);
    void this.shutdown();
  }

  private async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      logger.warn("Shutdown already in progress");
      return;
    }

    this.shutdownInProgress = true;
    logger.info("Starting graceful shutdown...");

    this.shutdownTimeout = setTimeout(() => {
      logger.error("Graceful shutdown timeout (10s), forcing exit");
      process.exit(1);
    }, 10000);

    try {
      await this.stopBot();
      await this.closeRedis();
      await this.closeHealthServer();

      this.clearShutdownTimeout();
      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      this.clearShutdownTimeout();
      logger.error({ err: error }, "Error during shutdown");
      process.exit(1);
    }
  }

  private async stopBot(): Promise<void> {
    logger.info("Stopping bot...");

    try {
      await this.bot.stop();
      logger.info("Bot stopped");
    } catch (error) {
      logger.error({ err: error }, "Error stopping bot");
      throw error;
    }
  }

  private async closeRedis(): Promise<void> {
    logger.info("Closing Redis connection...");

    try {
      await this.redis.quit();
      logger.info("Redis connection closed");
    } catch (error) {
      logger.error({ err: error }, "Error closing Redis");
      // Don't throw - continue shutdown
    }
  }

  private async closeHealthServer(): Promise<void> {
    if (!this.healthServer) {
      return;
    }

    logger.info("Closing health check server...");

    try {
      await new Promise<void>((resolve, reject) => {
        this.healthServer!.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      logger.info("Health server closed");
    } catch (error) {
      logger.error({ err: error }, "Error closing health server");
      // Don't throw - continue shutdown
    }
  }

  private clearShutdownTimeout(): void {
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = undefined;
    }
  }
}
```

**Использование:**

```typescript
// src/telegram-bot/index.ts

import { createBot } from "./bot.js";
import { Application } from "./application.js";
import { validateEnv } from "./env.js";
import { Redis } from "ioredis";
import express from "express";
import { logger } from "./logger.js";

const env = validateEnv();

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  facadeMcpUrl: env.FACADE_MCP_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  groqApiKey: env.GROQ_API_KEY,
  botToken: env.TELEGRAM_BOT_TOKEN,
  formatterLlm: {
    model: env.FORMATTER_LLM_MODEL,
    temperature: env.FORMATTER_LLM_TEMPERATURE,
  },
});

// Health check server
const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const healthServer = app.listen(3001, () => {
  logger.info("Health check server listening on port 3001");
});

// Create and start application
const application = new Application(bot, redis, healthServer);

await application.start();
```

**Плюсы:**

- ✅ **ООП подход:** Инкапсуляция всей логики shutdown
- ✅ **Testable:** Можно mock dependencies (bot, redis, server)
- ✅ **Разделение ответственности:** Каждый метод делает одно
- ✅ **Timeout защита:** Встроена
- ✅ **Error handling:** Для каждого компонента отдельно
- ✅ **Расширяемо:** Легко добавить новые ресурсы

**Минусы:**

- ❌ **Больше кода:** Новый класс
- ❌ **Complexity:** Для простого проекта может быть overkill

---

### 📊 Сравнение

| Подход | Сложность | Testability | Maintainability | Extensibility | Рекомендация |
|--------|-----------|-------------|-----------------|---------------|--------------|
| **Functional** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ OK |
| **OOP (Application)** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ **BEST** |

---

### 🎯 Рекомендация для WayMates

**Используйте OOP подход (Application class):**

**Причины:**

1. ✅ **Лучше для тестирования:** Можно mock Bot, Redis
2. ✅ **Чище разделение ответственности:** Каждый resource свой метод
3. ✅ **Легче добавлять новые ресурсы:** Facade client, Whisper, etc.
4. ✅ **Соответствует архитектуре проекта:** Services, OOP style
5. ✅ **Production-ready:** Используется в крупных проектах

**Время реализации:** ~30 минут

**Приоритет:** 🟡 **P1 (важно)** - нужно для стабильного production

---

### 🧪 Как тестировать

```typescript
// tests/telegram-bot/application.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Application } from "@/telegram-bot/application";

describe("Application shutdown", () => {
  let mockBot: any;
  let mockRedis: any;
  let mockServer: any;

  beforeEach(() => {
    mockBot = {
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockRedis = {
      quit: vi.fn(),
    };

    mockServer = {
      close: vi.fn((callback) => callback()),
    };
  });

  it("should close all resources on shutdown", async () => {
    const app = new Application(mockBot, mockRedis, mockServer);

    // Trigger shutdown
    process.emit("SIGTERM");

    // Wait for async shutdown
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockBot.stop).toHaveBeenCalled();
    expect(mockRedis.quit).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });
});
```

---

## 5. Webhook Secret Validation - Полный разбор

### 🔐 Что это такое?

**Webhook Secret Token** - это произвольная строка (1-256 символов), которую вы задаёте при настройке webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/telegram-webhook" \
  -d "secret_token=your-super-secret-string-abc123"
```

Telegram включает этот токен в **каждый** webhook request через HTTP header:

```
X-Telegram-Bot-Api-Secret-Token: your-super-secret-string-abc123
```

---

### ⚠️ Проблема БЕЗ secret token

**Сценарий атаки:**

```
1. Hacker знает ваш webhook URL:
   https://yourdomain.com/telegram-webhook

2. Hacker отправляет поддельный POST запрос:
   POST https://yourdomain.com/telegram-webhook
   Content-Type: application/json

   {
     "update_id": 999,
     "message": {
       "message_id": 1,
       "from": { "id": 123, "is_bot": false, "first_name": "Victim" },
       "chat": { "id": 123, "type": "private" },
       "date": 1701234567,
       "text": "/start"
     }
   }

3. Ваш bot ОБРАБАТЫВАЕТ запрос (думает что это от Telegram!)
   → Отправляет ответ user 123

4. Hacker может:
   - Спамить users от имени бота
   - Читать данные через reflection attacks
   - DoS атака (миллионы поддельных updates)
   - Украсть sessionId через timing attacks
```

**Реальный пример атаки:**

```
Hacker: POST /telegram-webhook
Body: {
  "message": {
    "from": { "id": 12345 },  // ID жертвы
    "text": "/token"           // Команда для получения токена
  }
}

Bot обрабатывает как настоящий update:
→ Вызывает handleToken(ctx)
→ Отправляет "Ваш токен: tok_abc123xyz" жертве
→ Hacker может перехватить ответ (если контролирует сеть жертвы)
```

**DoS атака:**

```
for i in {1..1000000}; do
  curl -X POST https://yourdomain.com/webhook \
    -d '{"update_id": '$i', "message": {...}}'
done

→ 1 миллион поддельных updates
→ Bot пытается обработать все
→ Redis переполняется sessions
→ MCP Facade падает от нагрузки
→ Bot становится недоступен
```

---

### ✅ Решение С secret token

**Шаг 1: Генерация токена**

```bash
# Вариант 1: OpenSSL (рекомендуется)
openssl rand -hex 32
# Output: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890

# Вариант 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Вариант 3: /dev/urandom
head -c 32 /dev/urandom | base64 | tr -d '=/+' | head -c 64
```

**Требования:**
- Длина: 1-256 символов
- Разрешённые символы: `A-Z`, `a-z`, `0-9`, `_`, `-`

**Шаг 2: Сохранение в .env**

```bash
# .env
WEBHOOK_SECRET=a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890

# ⚠️ ВАЖНО: добавить в .gitignore!
# .gitignore
.env
.env.local
.env.production
```

**Шаг 3: Настройка webhook**

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/telegram-webhook" \
  -d "secret_token=$WEBHOOK_SECRET"
```

**Шаг 4: Валидация в коде**

```typescript
// src/telegram-bot/webhook.ts

import { webhookCallback } from "grammy";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET environment variable is required for webhook mode");
}

const app = express();

// Middleware для проверки secret token
function validateWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== WEBHOOK_SECRET) {
    logger.warn(
      {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        receivedSecret: receivedSecret ? "[REDACTED]" : undefined,
      },
      "Invalid webhook secret token - potential attack attempt"
    );

    // НЕ раскрываем деталей в ответе
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// Применяем middleware ПЕРЕД обработкой webhook
app.use("/telegram-webhook", validateWebhookSecret);

app.use(
  "/telegram-webhook",
  webhookCallback(bot, "express", {
    // grammY также поддерживает встроенную проверку
    secretToken: WEBHOOK_SECRET,
  })
);

const PORT = process.env.PORT || 8443;
app.listen(PORT, () => {
  logger.info(`Webhook server listening on port ${PORT}`);
});
```

**Что происходит:**

```
✅ Telegram: POST /telegram-webhook
   Header: X-Telegram-Bot-Api-Secret-Token: a1b2c3d4e5f6...
   → validateWebhookSecret: tokens match ✅
   → next() вызывается
   → Bot обрабатывает update ✅

❌ Hacker: POST /telegram-webhook (БЕЗ header)
   → validateWebhookSecret: receivedSecret === undefined
   → Response: 401 Unauthorized
   → Bot НЕ обрабатывает update ✅
   → Атака провалилась!

❌ Hacker: POST /telegram-webhook
   Header: X-Telegram-Bot-Api-Secret-Token: wrong-token
   → validateWebhookSecret: "wrong-token" !== WEBHOOK_SECRET
   → Response: 401 Unauthorized
   → Bot НЕ обрабатывает update ✅
   → Атака провалилась!
```

---

### 🔐 Best Practices

#### 1. **Генерация токена**

**Требования безопасности:**

- ✅ Криптографически стойкий RNG (OpenSSL, crypto.randomBytes)
- ✅ Длина минимум 32 байта (64 hex символа)
- ❌ НЕ использовать: Date.now(), Math.random(), online generators

**Примеры:**

```bash
# ✅ GOOD: OpenSSL
openssl rand -hex 32

# ✅ GOOD: Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ❌ BAD: Предсказуемый
echo "my-secret-token-123"

# ❌ BAD: Слишком короткий
echo "abc123"
```

---

#### 2. **Rotation (смена токена)**

**Когда ротировать:**

- ⏰ **Регулярно:** Каждые 90 дней (профилактически)
- 🔴 **Немедленно:** При компрометации
- 🔴 **Немедленно:** После увольнения разработчика с доступом
- 🔴 **Немедленно:** При подозрении на утечку

**Процедура ротации:**

```bash
# 1. Генерируем новый токен
NEW_SECRET=$(openssl rand -hex 32)
echo "New secret: $NEW_SECRET"

# 2. Обновляем webhook в Telegram
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/telegram-webhook" \
  -d "secret_token=$NEW_SECRET"

# 3. Обновляем .env на сервере
echo "WEBHOOK_SECRET=$NEW_SECRET" >> .env.production

# 4. Деплоим новую версию (или перезапускаем)
kubectl rollout restart deployment/waymates-bot
# ИЛИ
pm2 restart waymates-bot

# 5. Проверяем что работает
curl https://yourdomain.com/telegram-webhook \
  -H "X-Telegram-Bot-Api-Secret-Token: $NEW_SECRET" \
  -d '{"update_id": 1}'
# Должен вернуть 200 (не 401)
```

---

#### 3. **Monitoring атак**

```typescript
// src/telegram-bot/webhook.ts

let invalidSecretCount = 0;
let lastResetTime = Date.now();

function validateWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== WEBHOOK_SECRET) {
    invalidSecretCount++;

    // Reset counter каждые 5 минут
    if (Date.now() - lastResetTime > 300000) {
      invalidSecretCount = 0;
      lastResetTime = Date.now();
    }

    // Алерт если много атак
    if (invalidSecretCount > 100) {
      logger.error(
        { count: invalidSecretCount, ip: req.ip },
        "SECURITY ALERT: High volume of invalid webhook secret attempts"
      );
      // Опционально: отправить в Sentry, PagerDuty, etc.
    }

    logger.warn(
      {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      "Invalid webhook secret - potential attack"
    );

    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// Metrics endpoint
app.get("/metrics", (req, res) => {
  res.json({
    invalidSecretAttempts: invalidSecretCount,
  });
});
```

---

### 🆚 Альтернативы и дополнительные меры

#### 1. **IP Whitelisting (дополнительная защита)**

```nginx
# nginx.conf
location /telegram-webhook {
    # Telegram IP ranges (обновляются периодически!)
    # https://core.telegram.org/bots/webhooks#the-short-version
    allow 149.154.160.0/20;
    allow 91.108.4.0/22;
    deny all;

    proxy_pass http://localhost:3000;
}
```

**Плюсы:**
- ✅ Дополнительная защита
- ✅ Блокирует большинство скрипт-кидди атак

**Минусы:**
- ❌ IP Telegram могут меняться (нужно обновлять)
- ❌ НЕ защищает если hacker внутри Telegram network
- ❌ Сложно поддерживать

**Рекомендация:** Используйте как дополнение к secret token, НЕ вместо него.

---

#### 2. **Secret URL path (слабая защита)**

```bash
# Вместо /webhook используем /webhook/<RANDOM_PATH>
https://yourdomain.com/webhook/a1b2c3d4e5f6.../telegram
```

**Плюсы:**
- ✅ Простая реализация

**Минусы:**
- ❌ Утечка токена в logs (access.log, nginx logs)
- ❌ Token может попасть в Referer headers
- ❌ Token виден в browser history
- ❌ Security through obscurity (не настоящая защита)

**Рекомендация:** НЕ используйте как основную защиту.

---

#### 3. **Rate Limiting (защита от DoS)**

```typescript
// src/telegram-bot/webhook.ts
import rateLimit from "express-rate-limit";

const webhookLimiter = rateLimit({
  windowMs: 1000,      // 1 секунда
  max: 30,             // 30 запросов на IP
  message: "Too many requests",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/telegram-webhook", webhookLimiter);
app.use("/telegram-webhook", validateWebhookSecret);
app.use("/telegram-webhook", webhookCallback(bot, "express", {
  secretToken: WEBHOOK_SECRET,
}));
```

**Защита от:**
- ✅ DoS атаки с одного IP
- ✅ Brute-force secret token

---

### 📊 Сравнение методов защиты

| Метод | Защита от подделки | Защита от DoS | Сложность | Поддержка Telegram | Рекомендация |
|-------|-------------------|---------------|-----------|---------------------|--------------|
| **Secret Token** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ✅ Нативно | ⭐⭐⭐⭐⭐ **ОБЯЗАТЕЛЬНО** |
| **IP Whitelist** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Совместимо | ⭐⭐⭐ Дополнительно |
| **Rate Limiting** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ✅ Совместимо | ⭐⭐⭐⭐ Рекомендуется |
| **Secret URL** | ⭐⭐ | ⭐ | ⭐ | ✅ Совместимо | ⭐ НЕ рекомендуется |

---

### 🎯 Итоговая рекомендация для WayMates

**Многоуровневая защита:**

```typescript
// src/telegram-bot/webhook.ts

// 1. Rate Limiting (первый барьер - DoS защита)
app.use("/telegram-webhook", webhookLimiter);

// 2. Secret Token validation (основная защита)
app.use("/telegram-webhook", validateWebhookSecret);

// 3. IP Whitelist (опционально, через nginx)
// См. nginx config выше

// 4. Обработка webhook
app.use("/telegram-webhook", webhookCallback(bot, "express", {
  secretToken: WEBHOOK_SECRET,  // grammY встроенная проверка (redundant, но безопаснее)
}));
```

**Приоритет:** 🟡 **P1 (важно)** - критично для production webhooks

**Время реализации:** ~30 минут

---

### 📚 Sources

**Telegram Official:**
- [Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq)

**Security Guides:**
- [Secret Token Verification](https://nguyenthanhluan.com/en/glossary/secret_token-for-setwebhook-en/)
- [Stack Overflow: Verify Webhook](https://stackoverflow.com/questions/69882004/how-verify-request-of-webhook-are-from-telegram)
- [FastAPI Telegram Webhook Security](https://github.com/b0g3r/fastapi-security-telegram-webhook)

**Implementation Examples:**
- [Telegram Webhook Implementation](https://github.com/thevickypedia/telegram-webhook)
- [Webhook Setup Guide](https://puc-telegram.com/blogs/466/)

---

## 📋 Итоговый чек-лист

### P0 (Критично - блокеры production):

- [ ] **Request Timeout** - Custom wrapper с AbortController (~15 мин)
- [ ] **Session TTL** - Global TTL 7 дней (~2 мин)
- [ ] **Error Monitoring** - Sentry integration (~1 час)

**Итого P0:** ~1.5 часа

---

### P1 (Важно для стабильности):

- [ ] **Health Check** - Полная проверка всех компонентов (~1 час)
- [ ] **Graceful Shutdown** - Application class (~30 мин)
- [ ] **Webhook Secret** - Validation middleware (~30 мин)

**Итого P1:** ~2 часа

---

**Общее время:** ~3.5 часа для P0+P1

**Рекомендуемый порядок:**

1. Session TTL (2 мин) - самое простое
2. Request Timeout (15 мин) - критично
3. Error Monitoring (1 час) - нужно для дебага остального
4. Health Check (1 час) - для мониторинга
5. Graceful Shutdown (30 мин) - стабильность
6. Webhook Secret (30 мин) - только если используете webhooks

---

**Последнее обновление:** 2025-12-08
**Статус:** Ready for implementation
**Next steps:** Начать с P0 tasks
