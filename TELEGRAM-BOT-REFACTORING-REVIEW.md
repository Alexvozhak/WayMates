# Ревью Плана Рефакторинга Telegram Bot

> **Дата**: 2025-12-08
> **Статус**: Критические проблемы обнаружены
> **Оценка плана**: 7/10

---

## ✅ Положительные Моменты

1. **Хорошая структуризация** — все пункты в формате "Проблема → Решение"
2. **Критические области покрыты** — timeout, TTL, graceful shutdown, security
3. **LLM Integration** — добавляет реальную ценность для UX
4. **Error Handling** — улучшает надежность системы
5. **Все решения зафиксированы** — i18n vs LLM, sessionId кэширование, fallback стратегия

---

## ❌ Критические Проблемы (Требуют Исправления)

### 1. SessionService — Отсутствует Redis в Конструкторе

**Проблема:**
```typescript
// План показывает:
export class SessionService {
  constructor(private mcpClient: McpClient) {}  // ← НЕТ redis!

  async getSessionId(ctx: BotContext): Promise<string> {
    const cacheKey = `telegram:session:${ctx.from.id}:sessionId`;
    let sessionId = await this.redis.get(cacheKey);  // ← this.redis не определен!
  }
}
```

**Решение:**
```typescript
export class SessionService {
  constructor(
    private mcpClient: McpClient,
    private redis: Redis  // ← ДОБАВИТЬ
  ) {}
}
```

---

### 2. Response Schemas Location — Архитектурная Ошибка

**Проблема:**

План говорит переместить response schemas в `shared/schemas.ts`:
```typescript
// shared/schemas.ts
export const telegramRegisterResponseSchema = z.object({ ... });
export const coldStartResponseSchema = z.object({ ... });
```

НО `shared/` предназначен для типов, используемых в ОБОИХ модулях (facade + telegram-bot).

Response schemas используются ТОЛЬКО в telegram-bot для валидации ответов от Facade.

**Нарушение принципа:** shared должен содержать только общие типы.

**Решение:**

Создать `telegram-bot/schemas/mcp-responses.ts`:
```typescript
// telegram-bot/schemas/mcp-responses.ts
export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export const coldStartResponseSchema = z.object({
  phase: z.enum(["COLLECTING", "CONFIRMATION", "COMPLETED"]),
  message: z.string(),
  hasStory: z.boolean().optional(),
});

export const searchResultResponseSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number(),
});
```

---

### 3. Порядок Фаз — Логически Неверный

**Проблема:**

Текущий порядок нарушает зависимости:
- Фаза 1 (sessionId cache) ЗАВИСИТ от Фазы 3 (SessionService)
- Фаза 3 (McpClient) ЗАВИСИТ от Фазы 2 (Tool Registry)

**Граф зависимостей:**
```
Фаза 2 (Tool Registry) → Фаза 3 (McpClient) → Фаза 1 (sessionId cache)
```

**Решение:**

**Вариант A: Переупорядочить фазы:**
1. Фаза 0: Handlers рефакторинг
2. Фаза 2: Архитектурные изменения (response schemas, tool registry, discriminated union)
3. Фаза 3: ООП (McpClient, SessionService, SearchPresenter)
4. Фаза 1: Production Readiness (timeout, TTL, sessionId cache, graceful shutdown)
5. Фаза 4: LLM Integration
6. Фаза 5: Error Handling
7. Фаза 6: Security

**Вариант B: Разделить Фазу 1:**
- Фаза 1a: Request Timeout + Graceful Shutdown (независимо, можно делать первыми)
- Фаза 1b: sessionId кэширование (после SessionService)

**Рекомендую:** Вариант B (меньше перестановок).

---

### 4. BotServices Тип — Не Обновлен

**Проблема:**

План вводит новые классы, но не показывает как обновить `BotServices`:

```typescript
// Текущий:
export type BotServices = {
  openaiApiKey: string;
  facadeMcpUrl: string;
  formatterLlm: LlmConfig;
};

// Должен стать:
export type BotServices = {
  mcpClient: McpClient;           // НОВОЕ
  sessionService: SessionService; // НОВОЕ
  searchPresenter: SearchPresenter; // НОВОЕ
  // openaiApiKey, facadeMcpUrl, formatterLlm — УБРАТЬ (дублирование)
};
```

**Вопрос:** Как избежать дублирования конфигурации?
- `openaiApiKey` нужен и в McpClient, и в SearchPresenter
- `facadeMcpUrl` нужен в McpClient

**Решение:**

```typescript
// index.ts
const mcpClient = new McpClient(env.FACADE_MCP_URL, env.FACADE_REQUEST_TIMEOUT_MS);
const sessionService = new SessionService(mcpClient, redis);
const searchPresenter = new SearchPresenter(env.OPENAI_API_KEY, env.FORMATTER_LLM_CONFIG);

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  mcpClient,
  sessionService,
  searchPresenter,
});
```

---

### 5. SearchPresenter Конструктор — Не Определен

**Проблема:**

План показывает:
```typescript
export class SearchPresenter {
  constructor(private llm: ChatOpenAI) {}
}
```

НО текущий `formatSearchResult` создаёт llm на каждый вызов:
```typescript
const llm = new ChatOpenAI({
  modelName: llmConfig.model,
  temperature: llmConfig.temperature,
  openAIApiKey: apiKey,
});
```

**Вопрос:** Как SearchPresenter получает `apiKey` и `llmConfig`?

**Решение:**

```typescript
export class SearchPresenter {
  private llm: ChatOpenAI;

  constructor(apiKey: string, llmConfig: LlmConfig) {
    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
    });
  }

  async formatSearchResult(rawJsonResult: string, languageCode: string): Promise<string> {
    const prompt = createPrompt(rawJsonResult, languageCode);
    const response = await this.llm.invoke(prompt);
    return response.content.trim();
  }
}
```

---

### 6. McpClient callTool() — Breaking Change

**Проблема:**

Переход на Tool Registry + ООП McpClient — breaking change для ВСЕХ handlers:

```typescript
// Было:
const result = await callTool(ctx, "search_by_target", searchParams);

// Станет:
const result = await ctx.services.mcpClient.callTool("search_by_target", searchParams);
```

**Затронуты файлы:**
- `handlers/by-target.ts`
- `handlers/by-adhoc.ts`
- `handlers/by-current.ts`
- `handlers/story.ts`
- `handlers/link.ts`
- `handlers/token.ts`

**План не учитывает** масштаб изменений!

**Решение:**

Добавить в план "Migration Sub-Phase":
1. Создать McpClient класс с новым API
2. Обновить ВСЕ handlers (6 файлов)
3. Удалить старый функциональный `callTool`
4. Quality gates (lint, tsc, integration tests)

---

## ⚠️ Спорные Решения (Требуют Обсуждения)

### 1. Фаза 3 (ООП Рефакторинг) — Большая Работа, Малая Выгода

**Вопрос:** Зачем переходить на ООП?

**Текущий стиль (функциональный):**
```typescript
// Функции + Grammy context
export async function callTool(ctx: BotContext, toolName: string, params: any) { ... }
export async function formatSearchResult(params: FormatSearchParams) { ... }
```

**Планируемый стиль (ООП):**
```typescript
// Классы с DI
class McpClient { async callTool(...) { ... } }
class SearchPresenter { async formatSearchResult(...) { ... } }
```

**Плюсы ООП:**
- ✅ Легче тестировать (моки через конструктор)
- ✅ Явные зависимости
- ✅ Соответствует "enterprise" паттернам

**Минусы ООП:**
- ❌ Больше boilerplate кода
- ❌ Сложнее для новичков
- ❌ Grammy экосистема использует функции, не классы
- ❌ Текущий код работает корректно

**Рекомендация:** Фаза 3 (ООП) — **опциональна**, можно отложить или отменить.

**Альтернатива:** Оставить функциональный стиль, добавить только DI через параметры.

---

### 2. Tool Registry — Type Safety vs Сложность

**Вопрос:** Стоит ли сложность реализации того уровня type safety?

**Без Tool Registry (текущий):**
```typescript
const result = await callTool(ctx, "search_by_target", searchParams);
// Нет compile-time проверки toolName и params
```

**С Tool Registry:**
```typescript
const result = await mcpClient.callTool("search_by_target", searchParams);
// ✅ Compile-time проверка toolName
// ✅ Compile-time проверка params типа
// ✅ Compile-time проверка response типа
```

**Стоимость:**
- Создать TOOL_REGISTRY с 17 tools
- Реализовать generic callTool<T extends ToolName>
- Обновить ВСЕ handlers

**Выгода:**
- Ловим ошибки на этапе компиляции (не runtime)
- Autocomplete в IDE

**Рекомендация:** Можно упростить — использовать Zod валидацию БЕЗ Tool Registry:

```typescript
export async function callTool(
  ctx: BotContext,
  toolName: string,
  params: Record<string, unknown>,
  responseSchema: z.ZodType  // ← Передавать схему явно
): Promise<unknown> {
  // Runtime валидация params + response
}
```

---

### 3. sessionId Кэширование — Оптимизация vs Сложность

**Вопрос:** Стоит ли экономия ~100ms на запрос добавления сложности?

**Без кэша:**
- register_telegram вызывается при КАЖДОМ запросе к Facade
- Просто: нет отдельного Redis ключа, нет TTL логики

**С кэшем (план):**
- register_telegram вызывается раз в 30 минут
- Сложно: два Redis ключа, логика TTL, SessionService.getSessionId()

**Выгода:** Экономия ~100ms на каждый запрос (register_telegram легковесный, но всё равно HTTP + Neo4j read).

**Стоимость:** Дополнительный код, сложность, риск багов с протухшим кэшем.

**Рекомендация:** Можно отложить оптимизацию до профилирования в production.

---

## 💡 Рекомендации

### Высокий Приоритет (Исправить в Плане)

1. ✅ Добавить `Redis` в конструктор `SessionService`
2. ✅ Создать `telegram-bot/schemas/mcp-responses.ts` вместо `shared/schemas.ts`
3. ✅ Переупорядочить фазы или разделить Фазу 1 на 1a/1b
4. ✅ Обновить тип `BotServices` в плане
5. ✅ Определить конструктор `SearchPresenter`
6. ✅ Добавить "Migration Plan" для breaking changes в handlers

### Средний Приоритет (Обсудить)

7. ⚠️ Переосмыслить необходимость Фазы 3 (ООП) — можно сделать опциональной
8. ⚠️ Упростить Tool Registry — использовать только Zod валидацию
9. ⚠️ Отложить sessionId кэширование — профилировать сначала

### Низкий Приоритет

10. 📝 Объединить REFACTOR-PLAN.md и TELEGRAM-BOT-REFACTORING-PLAN.md (один источник правды)
11. 📝 Добавить диаграммы зависимостей между фазами

---

## 📊 Итоговая Оценка

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Структура** | 9/10 | Хорошо организовано, понятный формат |
| **Полнота** | 6/10 | Много недостающих деталей (конструкторы, типы) |
| **Корректность** | 5/10 | Критические ошибки (Redis, порядок фаз, schemas location) |
| **Рациональность** | 7/10 | Спорные решения (ООП, Tool Registry, sessionId cache) |
| **Реализуемость** | 6/10 | Breaking changes не учтены, зависимости нарушены |

**ОБЩАЯ ОЦЕНКА: 7/10**

---

## ✅ Следующие Шаги

1. **Исправить критические проблемы** в TELEGRAM-BOT-REFACTORING-PLAN.md
2. **Обсудить спорные решения** (ООП, Tool Registry, sessionId cache)
3. **Актуализировать** `.claude/commands/refactor-telegram-bot.md`
4. **Начать реализацию** по исправленному плану

---

**Статус:** План требует доработки перед началом реализации ⚠️
