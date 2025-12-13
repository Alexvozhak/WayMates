# Интеграция Pino Logging в WayMates

Комплексная интеграция структурированного логирования через Pino во все модули проекта.

## Контекст задачи

WayMates — multi-service архитектура:
- **telegram-bot** — точка входа, взаимодействие с пользователем
- **facade** — MCP сервер, LangGraph агенты, бизнес-логика
- **core** — tRPC API, Neo4j queries, data layer

Цель: единая система логирования для debugging и production monitoring.

---

## Согласованные решения

| Параметр | Значение |
|----------|----------|
| **Location** | `src/shared/logger.ts` (единый, импортируется всеми) |
| **Default level** | `info` (override через `LOG_LEVEL` env) |
| **RequestId** | Генерить в bot, передавать в MCP params |
| **Redaction** | `password, token, apiKey, *.password, *.token` |
| **Dev format** | `pino-pretty` (colorize: true) |
| **Prod output** | stdout only (JSON) |
| **Timestamp** | ISO format (`2024-12-12T15:30:45.123Z`) |

### Что логировать на INFO
- User actions: `/story`, `/by_target`, callbacks
- Начало/конец операций: `tool:start`, `tool:complete`
- Ключевые решения: `phase:gather_story`, `already_saved:true`
- Внешние вызовы: `MCP call`, `Core API call`

### Что НЕ логировать
- Полный текст сообщений пользователя (только `messageLength`)
- LLM prompts/responses (есть LangSmith)
- Каждую итерацию циклов (только summary)
- Успешные health checks

---

## Чеклист выполнения

### Этап 1: Shared Logger

- [ ] Создать `src/shared/logger.ts`:
  ```typescript
  // Требования:
  // - pino с ISO timestamp
  // - Redaction для sensitive полей
  // - pino-pretty для NODE_ENV=development
  // - Serializer для Error (pino.stdSerializers.err)
  // - Mixin для автоматического добавления service name
  // - Factory: createLogger(component: string)
  // - Factory: createRequestLogger(component: string, requestId: string, userId?: string)
  ```
- [ ] Экспортировать типы если нужно
- [ ] Проверить что pino и pino-pretty уже в dependencies

### Этап 2: Telegram Bot

- [ ] Заменить `src/telegram-bot/logger.ts` на re-export из shared:
  ```typescript
  export { createLogger, createRequestLogger } from '../shared/logger.js';
  export const logger = createLogger('telegram-bot');
  ```
- [ ] `handlers/start.ts` — добавить:
  - `INFO: user action /start`
- [ ] `handlers/story.ts` — добавить:
  - `INFO: user action /story`
  - `INFO: calling MCP tool:cold_start`
  - `INFO: MCP returned phase:X`
- [ ] `handlers/callbacks.ts` — добавить:
  - `INFO: callback action:approve/edit/cancel`
- [ ] `handlers/input-router.ts` — добавить:
  - `DEBUG: routing input to handler:X`
- [ ] `services/mcp-client.ts` — добавить:
  - `INFO: MCP call tool:X`
  - `DEBUG: MCP response received`
  - `ERROR: MCP call failed`
- [ ] `services/session-service.ts` — добавить:
  - `DEBUG: session initialized`
  - `DEBUG: session retrieved from cache`
- [ ] Генерация requestId:
  - В начале каждого command handler генерировать `requestId = crypto.randomUUID()`
  - Передавать в MCP params как `{ ...params, requestId }`

### Этап 3: Facade

- [ ] Создать `src/facade/logger.ts`:
  ```typescript
  import { createLogger, createRequestLogger } from '../shared/logger.js';
  export { createRequestLogger };
  export const logger = createLogger('facade');
  ```
- [ ] `mcp-server/tools/base-tool.ts` — добавить:
  - `INFO: tool:X start` (с requestId, userId)
  - `INFO: tool:X complete` (с phase, durationMs)
  - `ERROR: tool:X failed` (с error)
- [ ] `mcp-server/tools/cold-start.tool.ts` — добавить:
  - `DEBUG: checking isColdStartCompleted`
  - `INFO: cold_start already_saved:true` (если applicable)
  - `INFO: cold_start phase:X`
- [ ] `langGraph/cold-start-v2/cold-start-graph.ts` — добавить:
  - `DEBUG: graph invoke hasPendingInterrupt:X`
  - `INFO: graph complete phase:X`
- [ ] `core-client.ts` — добавить:
  - `INFO: Core API call method:X`
  - `DEBUG: Core API response`
  - `ERROR: Core API failed`
- [ ] `services/normalizer.ts` — добавить:
  - `DEBUG: normalizing term type:X`
  - `DEBUG: cache hit/miss`

### Этап 4: Core

- [ ] Создать `src/core/logger.ts`:
  ```typescript
  import { createLogger } from '../shared/logger.js';
  export const logger = createLogger('core');
  ```
- [ ] `managers/search-manager.ts` — добавить:
  - `INFO: search start type:X`
  - `INFO: search complete results:N`
- [ ] `managers/context-manager.ts` — добавить:
  - `INFO: context upsert userId:X`
  - `INFO: context update userId:X`
- [ ] `managers/trail-manager.ts` — добавить:
  - `INFO: trail upsert userId:X`
- [ ] `database-context.ts` — добавить:
  - `DEBUG: Neo4j read query`
  - `DEBUG: Neo4j write query`
  - `WARN: Neo4j slow query >500ms` (с duration)

### Этап 5: Environment

- [ ] `.env.test` — добавить:
  ```
  LOG_LEVEL=debug
  ```
- [ ] `docker-compose.yml` — добавить в facade-test, core-test:
  ```yaml
  environment:
    LOG_LEVEL: ${LOG_LEVEL:-info}
  ```

### Этап 6: Валидация

- [ ] `npm run lint` — без ошибок
- [ ] `npx tsc --noEmit` — без ошибок
- [ ] Запустить bot локально с `LOG_LEVEL=debug`
- [ ] Проверить что логи выводятся в pino-pretty формате
- [ ] Проверить что requestId прокидывается bot → facade
- [ ] Проверить redaction (password не попадает в логи)

---

## Формат логов

### Development (pino-pretty)
```
[15:30:45.123] INFO (telegram-bot): user action
    requestId: "abc-123"
    userId: 456
    command: "/story"

[15:30:45.200] INFO (facade): tool start
    requestId: "abc-123"
    tool: "cold_start"
    userId: "user-456"

[15:30:46.500] INFO (facade): tool complete
    requestId: "abc-123"
    tool: "cold_start"
    phase: "gather_story"
    durationMs: 1300
```

### Production (JSON)
```json
{"level":30,"time":"2024-12-12T15:30:45.123Z","service":"telegram-bot","component":"story","requestId":"abc-123","userId":456,"command":"/story","msg":"user action"}
```

---

## Паттерны использования

### В handler с requestId
```typescript
import { createRequestLogger } from '../logger.js';

export async function handleStory(ctx: BotContext): Promise<void> {
  const requestId = crypto.randomUUID();
  const log = createRequestLogger('story', requestId, String(ctx.from?.id));

  log.info({ command: '/story' }, 'user action');

  // ... logic

  log.info({ phase: result.phase }, 'MCP returned');
}
```

### В tool с requestId из params
```typescript
import { createRequestLogger } from '../../logger.js';

protected async executeImpl(params: Params, userId: UserId): Promise<Response> {
  const log = createRequestLogger('cold-start', params.requestId, userId);
  const startTime = Date.now();

  log.info('tool start');

  // ... logic

  log.info({ phase: response.phase, durationMs: Date.now() - startTime }, 'tool complete');
  return response;
}
```

### Логирование ошибок
```typescript
try {
  // ...
} catch (error) {
  log.error({ err: error }, 'operation failed');
  throw error;
}
```

---

## Критерии завершения

1. Все файлы из чеклиста обновлены
2. Lint и TypeScript проходят без ошибок
3. Логи выводятся корректно в dev и prod форматах
4. RequestId прокидывается через весь flow
5. Sensitive данные редактируются
