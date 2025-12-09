# Аудит: План vs Реальность

**Дата**: 2025-12-09
**Задача**: Проверить всё ли из плана TELEGRAM-BOT-REFACTORING-PLAN.md реально выполнено

---

## ✅ Что выполнено согласно плану

### Production Readiness

1. **Request Timeout** ✅
   - env.ts:7 - FACADE_REQUEST_TIMEOUT_MS
   - mcp-client.ts:42 - timeout: timeoutMs

2. **Conversation State Cleanup (TTL 7 дней)** ✅
   - bot.ts:60 - ttl: 604_800

3. **Graceful Shutdown** ✅
   - index.ts:40-47 - shutdown() с bot.stop() + redis.quit()
   - index.ts:49-50 - SIGTERM/SIGINT handlers

### Архитектурные решения

5. **Response Schemas** ✅
   - schemas/mcp-responses.ts существует
   - Все схемы на месте: sessionIdSchema, errorResponseSchema, telegramRegisterResponseSchema, searchResultResponseSchema

6. **Runtime Валидация** ✅
   - mcp-client.ts:46-56 - callTool с paramsSchema и responseSchema
   - paramsSchema.parse(params) на строке 52
   - responseSchema.parse(parsedContent) на строке 55

7. **Discriminated Union** ✅ (частично)
   - types.ts:28-35 - MySessionData как discriminated union
   - ❌ Guards НЕ реализованы как в плане (см. ниже)

8. **ООП Архитектура** ✅
   - McpClient класс создан
   - SessionService класс создан
   - SearchPresenter класс создан
   - ColdStartPresenter класс создан
   - WelcomePresenter класс создан (добавлен сверх плана)
   - Все 6 handlers обновлены на ООП стиль

---

## ❌ Что НЕ выполнено / отличается от плана

### 1. Webhook Secret Validation (P1) - НЕ ВЫПОЛНЕНО

**План** (строки 112-130):
```typescript
// env.ts
TELEGRAM_WEBHOOK_SECRET: z.string().optional()

// bot.ts
if (env.USE_WEBHOOK) {
  const handleWebhook = webhookCallback(bot, "std/http", {
    secretToken: env.TELEGRAM_WEBHOOK_SECRET,
  });
}
```

**Реальность**:
- Нет TELEGRAM_WEBHOOK_SECRET в env.ts
- Нет webhookCallback вообще

**Статус**: ⚠️ Опциональная фаза (P1), отложена

---

### 2. Guards Middleware - РЕАЛИЗОВАНЫ ПО-ДРУГОМУ

**План** (строки 283-298):
```typescript
// Guard для commands (автоматическая инициализация)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx);
  }
  await next();
});

// Guard для callbacks (session может протухнуть)
bot.callbackQuery(/^decision:/, async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    await ctx.editMessageText(ctx.t("session-expired"));
    return;
  }
  await next();
});
```

**Реальность** (bot.ts):
```typescript
// НЕТ автоматической инициализации в middleware
bot.use(async (ctx, next) => {
  ctx.services = services;  // только проставляем services
  await next();
});

// НЕТ guard middleware для callbacks
bot.callbackQuery("decision:approve", handleApproveCallback);
bot.callbackQuery("decision:edit", handleEditCallback);
bot.callbackQuery("decision:cancel", handleCancelCallback);
```

**Где логика?**:
- Инициализация: только в `handleStart` (handlers/start.ts:6)
- Session check: в каждом callback handler вручную (callbacks.ts:19)

**Проблема**:
- Дублирование: каждый handler должен проверять session
- Не centralized: легко забыть добавить проверку

**Рекомендация**: ⚠️ Реализовать guards как в плане

---

### 3. Health Check - Использует fetch вместо axios

**План** (строки 739-740):
```typescript
await axios.get(`${env.FACADE_MCP_URL}/health`, { timeout: 5000 });
logger.info("Facade MCP reachable");
```

**Реальность** (index.ts:21-29):
```typescript
const facadeHealthUrl = `${env.FACADE_MCP_URL.replace("/mcp", "")}/health`;
const response = await fetch(facadeHealthUrl, {
  signal: AbortSignal.timeout(5000),
});

if (!response.ok) {
  throw new Error(`Facade health check failed: ${response.status}`);
}
```

**Проблемы**:
1. `.replace("/mcp", "")` - странная логика, хрупкая
2. `fetch` вместо `axios` (несогласованность - везде axios, тут fetch)
3. Нет import axios в index.ts

**Рекомендация**: ✅ Исправить на axios как в плане

---

### 4. ColdStartPresenter в formatters/ вместо presenters/

**Реальность**:
```
presenters/
  base-presenter.ts
  search-presenter.ts
  welcome-presenter.ts

formatters/
  story.ts  ← ColdStartPresenter здесь! ❌
```

**Проблема**: Несогласованность
- SearchPresenter в presenters/
- WelcomePresenter в presenters/
- ColdStartPresenter в formatters/

**Рекомендация**: ✅ Переместить ColdStartPresenter в presenters/

---

### 5. Отсутствует PresenterError для typed error handling

**Реальность** (errors.ts):
```typescript
export class BotError extends Error { ... }
export class SessionExpiredError extends BotError { ... }
export class McpClientError extends BotError { ... }
export class WhisperError extends BotError { ... }
export class NlpParseError extends BotError { ... }
// ❌ Нет PresenterError!
```

**Где нужно** (handlers/start.ts:20):
```typescript
} catch (error) {
  logger.error({ err: error }, "Failed to generate welcome message");
  await ctx.reply(ctx.t("error-generic"));  // ← кидает сырой Error
}
```

**Проблема**: Нет typed error для LLM failures

**Рекомендация**: ✅ Добавить PresenterError

---

## 📁 Файловая структура - Несоответствия

### Текущая структура:

```
src/telegram-bot/
  formatters/
    story.ts  ← ColdStartPresenter (❌ должен быть в presenters/)

  presenters/
    base-presenter.ts
    search-presenter.ts
    welcome-presenter.ts  ← добавлен сверх плана (✅)

  services/
    mcp-client.ts
    session-service.ts
    nlp-parser.ts
    pending-actions.ts
    whisper.ts
```

### Рекомендуемая структура:

```
src/telegram-bot/
  formatters/  ← УДАЛИТЬ (presenters покрывает всё)

  presenters/
    base-presenter.ts
    search-presenter.ts
    cold-start-presenter.ts  ← переместить из formatters/story.ts
    welcome-presenter.ts
```

---

## 🎯 Приоритет исправлений

### P0 (критично)

1. **Переместить ColdStartPresenter**: `formatters/story.ts` → `presenters/cold-start-presenter.ts`
   - Обновить импорты в types.ts, index.ts, handlers/story.ts
   - Удалить пустую директорию formatters/

2. **Исправить health check**: fetch → axios
   - Убрать `.replace("/mcp", "")`
   - Использовать axios как во всём проекте

3. **Добавить PresenterError**:
   ```typescript
   export class PresenterError extends BotError {}
   ```

### P1 (желательно)

4. **Реализовать Guards middleware** как в плане:
   - bot.use с автоматической инициализацией
   - bot.callbackQuery(/^decision:/) с session expiry check
   - Убрать дублирование проверок из handlers

### P2 (опционально)

5. **Webhook Secret Validation** - отложено до production deploy

---

## ✅ Что СДЕЛАНО сверх плана (хорошо!)

1. **WelcomePresenter** создан для /start handler
   - План предлагал функциональную generateWelcomeMessage()
   - Реализовали через BasePresenter (consistency!)

2. **BasePresenter** с Template Method pattern
   - План предлагал просто классы
   - Сделали правильную абстракцию

3. **Удалены рудименты** (в текущей сессии):
   - formatters/search.ts
   - services/llm-formatter.ts
   - services/mcp-utils.ts

---

## 📊 Итоговая оценка

**Выполнено согласно плану**: 85%
**Отличия от плана**: 15% (guards, health check, файловая структура)

**Общее качество**: 8/10

**Что хорошо**:
- ✅ Вся архитектура ООП реализована
- ✅ Runtime валидация работает
- ✅ Production readiness (timeout, shutdown, TTL)
- ✅ BasePresenter pattern лучше чем в плане

**Что нужно исправить**:
- 📁 Файловая структура (ColdStartPresenter не там)
- 🛡️ Guards middleware (не реализованы)
- 🏥 Health check (fetch вместо axios)
- 🚨 PresenterError (отсутствует)
