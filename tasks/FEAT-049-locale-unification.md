# FEAT-049: Унификация локализации (Locale из MCP Client)

**Status**: DONE
**Priority**: P1
**Component**: Facade, Telegram, Chart, MCP API
**Created**: 2025-12-28
**Depends on**: -
**Blocks**: -

---

## Проблема

Сейчас локализация работает так:
1. Facade генерирует ответы на **английском** (hardcoded `Language: English` в промптах)
2. Telegram **переводит** через LLM (SystemMessagePresenter) — лишний вызов
3. Chart **hardcoded** `locale: "ru"` в 3 местах

**Проблемы:**
- Лишний LLM вызов на каждое сообщение (latency + cost)
- Hardcoded "ru" в Chart — не работает для EN пользователей
- FlowGuardChecker и QueryExecutor возвращают hardcoded English

---

## Решение

**MCP Client передаёт locale** в params → Facade использует везде:

1. `converse(locale)` — MCP client передаёт язык пользователя
2. ConverseTool передаёт locale в FlowGuardChecker, QueryExecutor, GraphManager
3. GraphManager сохраняет locale в state графов (для Chart)
4. NlpFormatter использует `Language: {language}` в промптах
5. Chart берёт `state.locale` для labels
6. Telegram **не переводит** — получает message на нужном языке

**Почему этот подход:**
- Locale известен с первой строчки — нет проблем с "LLM до parse nodes"
- FlowGuardChecker/QueryExecutor получают locale из params
- cancel() получает locale из params (не нужен доступ к state)

---

## Архитектура

```
Telegram                        Facade
   │                              │
   │ ctx.from.language_code="ru"  │
   │ ─────────────────────────────►
   │ converse(locale="ru")        │
   │                              │
   │                   ConverseTool.executeImpl(params)
   │                        │
   │                        │ locale = params.locale ?? "en"
   │                        │
   │                   ┌────┴────┐
   │                   │         │
   │            FlowGuardChecker │ GraphManager
   │            (locale)         │ (locale)
   │                   │         │
   │             guards:         │ graph.run(locale)
   │             "Привет!"       │     │
   │                   │         │     ▼
   │                   │    state.locale = "ru"
   │                   │         │
   │                   │    NlpFormatter.format(locale)
   │                   │    "Language: Russian"
   │                   │         │
   │                   │    Chart: FIELD_LABELS["ru"]
   │                   │         │
   │ ◄─────────────────┴─────────┘
   │ message (на русском)
   │
   │ reply(message) — NO LLM!
```

---

## План работ

### Фаза 1: MCP Schema (~10 LOC)

| # | Задача | Файл |
|---|--------|------|
| 1.1 | +`localeSchema` = `z.enum(["en", "ru"]).default("en")` | `src/shared/schemas.ts` |
| 1.2 | +`locale` в `mcpConverseParamsSchema` | `src/shared/schemas.ts` |

```typescript
export const localeSchema = z.enum(["en", "ru"]).default("en");
export type Locale = z.infer<typeof localeSchema>;

export const mcpConverseParamsSchema = z.object({
  message: z.string().min(1),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
  locale: localeSchema.optional(),  // NEW
});
```

### Фаза 2: ConverseTool (~15 LOC)

| # | Задача | Файл |
|---|--------|------|
| 2.1 | Получить `locale` из params | `src/facade/mcp-server/tools/converse.tool.ts` |
| 2.2 | Передать в FlowGuardChecker | `converse.tool.ts` |
| 2.3 | Передать в GraphManager | `converse.tool.ts` |
| 2.4 | Передать в QueryExecutor | `converse.tool.ts` |

```typescript
async executeImpl(params: McpConverseParams, userId: UserId): Promise<ConverseResponse> {
  const locale = params.locale ?? "en";  // NEW

  // Guards
  const guardResult = await this.flowGuardChecker.check(intent, userId, locale);

  // Query
  const queryResult = await this.queryExecutor.execute(intent, userId, locale);

  // Graph
  const graphResult = await this.graphManager.executeNewGraph(intent, message, userId, locale);
}
```

### Фаза 3: FlowGuardChecker (~20 LOC)

| # | Задача | Файл |
|---|--------|------|
| 3.1 | +`locale` param в `check()` | `src/facade/services/orchestrator/flow-guard-checker.service.ts` |
| 3.2 | +`nlpFormatter` dependency | то же |
| 3.3 | Форматировать сообщения через NlpFormatter | то же |

```typescript
export class FlowGuardChecker {
  constructor(
    private readonly coreClient: CoreClient,
    private readonly nlpFormatter: NlpFormatter,  // NEW
  ) {}

  async check(intent: UserIntent, userId: UserId, locale: Locale): Promise<ConverseResponse | null> {
    if (intent === "greeting") {
      const message = await this.nlpFormatter.formatGuard("greeting", locale);
      return createNlpResponse(message);
    }
    // ... остальные guards
  }
}
```

### Фаза 4: QueryExecutor (~15 LOC)

| # | Задача | Файл |
|---|--------|------|
| 4.1 | +`locale` param в `execute()` | `src/facade/services/orchestrator/query-executor.service.ts` |
| 4.2 | +`nlpFormatter` dependency | то же |
| 4.3 | Форматировать сообщения через NlpFormatter | то же |

### Фаза 5: GraphManager (~25 LOC)

| # | Задача | Файл |
|---|--------|------|
| 5.1 | +`locale` в `GraphInput` type | `src/facade/services/orchestrator/graph-manager.service.ts` |
| 5.2 | +`locale` param в `executeActiveGraph()`, `executeNewGraph()` | то же |
| 5.3 | Передать locale в `graph.run()` | то же |
| 5.4 | Передать locale в `nlpFormatter.format()` | то же |
| 5.5 | +`locale` param в `cancel()` | то же |

```typescript
type GraphInput = {
  type: GraphType;
  message: string;
  userId: UserId;
  intent: GraphIntent | null;
  locale: Locale;  // NEW
};

async executeNewGraph(intent, message, userId, locale): Promise<ConverseResponse | null> {
  return this.run({ type: graphType, message, userId, intent, locale });
}

private async run(input: GraphInput): Promise<ConverseResponse> {
  const result = await this.executeGraph(input, threadId);
  const message = await this.nlpFormatter.format(result, input.type, input.locale);
  return { result, message, activeGraph: input.type };
}

private async cancel(graphType, userId, locale): Promise<ConverseResponse> {
  await this.deps.checkpointService.delete(threadId);
  const result = { phase: PHASE.cancelled };
  const message = await this.nlpFormatter.format(result, graphType, locale);
  return { result, message, activeGraph: graphType };
}
```

### Фаза 6: Graph States (~10 LOC)

| # | Задача | Файл |
|---|--------|------|
| 6.1 | +`locale` в `searchStateAnnotation` | `src/facade/langGraph/search-graph/state.ts` |
| 6.2 | +`locale` в остальных 4 state файлах | `cold-start-v2`, `upsert-context`, `update-context`, `upsert-trail` |

```typescript
locale: Annotation<Locale>({ reducer: lastValue, default: () => "en" }),
```

### Фаза 7: Graph Classes (~20 LOC)

| # | Задача | Файл |
|---|--------|------|
| 7.1 | +`locale` param в `SearchGraph.run()` | `src/facade/langGraph/search-graph/search-graph.ts` |
| 7.2 | +`locale` в initial state при `invoke()` | то же |
| 7.3 | То же для остальных 4 графов | `cold-start-graph.ts`, `upsert-context-graph.ts`, etc. |

```typescript
async run(message, threadId, userId, intent, locale): Promise<SearchGraphResponse> {
  const result = hasPendingInterrupt
    ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
    : await this.compiledGraph.invoke({
        userId,
        locale,  // NEW
        orchestratorIntent: intent,
        userResponse: message,
      }, config);
}
```

### Фаза 8: NlpFormatter (~20 LOC)

| # | Задача | Файл |
|---|--------|------|
| 8.1 | +`locale` param в `format()` | `src/facade/services/nlp-formatter/nlp-formatter.service.ts` |
| 8.2 | +`formatGuard()` method | то же |
| 8.3 | `Language: {language}` в промптах | `src/facade/services/nlp-formatter/prompts.ts` |
| 8.4 | `LANGUAGE_MAP` | `prompts.ts` |
| 8.5 | `GUARD_MESSAGES` | `prompts.ts` |

```typescript
const LANGUAGE_MAP: Record<Locale, string> = {
  en: "English",
  ru: "Russian",
};

export class NlpFormatter {
  async format(result: AnyGraphResponse, graphType: GraphType, locale: Locale = "en"): Promise<string> {
    const language = LANGUAGE_MAP[locale];
    const prompt = GRAPH_PROMPTS[graphType].replace("Language: English", `Language: ${language}`);
    // ...
  }

  async formatGuard(guardType: GuardType, locale: Locale): Promise<string> {
    const language = LANGUAGE_MAP[locale];
    const prompt = GUARD_PROMPTS[guardType].replace("{language}", language);
    // ...
  }
}
```

### Фаза 9: Chart (~25 LOC)

| # | Задача | Файл |
|---|--------|------|
| 9.1 | `state.locale` вместо "ru" | `nodes/show-results.ts` |
| 9.2 | `state.locale` вместо "ru" | `nodes/validate-goal.ts` |
| 9.3 | `state.locale` вместо "ru" | `nodes/explore.ts` |
| 9.4 | `FIELD_LABELS[locale]` | `src/chart/builders/html-renderer.ts` |

```typescript
const FIELD_LABELS: Record<Locale, Record<ChartableField, string>> = {
  en: { position: "Grade", role: "Role", domains: "Domain", ... },
  ru: { position: "Грейд", role: "Роль", domains: "Домен", ... },
};
```

### Фаза 10: Telegram (~5 LOC, -15 LOC)

| # | Задача | Файл |
|---|--------|------|
| 10.1 | Передать `language_code` в converse | `src/telegram-bot/handlers/converse.ts` |
| 10.2 | Убрать translate из `formatResponse` | `src/telegram-bot/presenters/format-response.ts` |

```typescript
// converse.ts
const converseResp = await ctx.services.mcpClient.callTool("converse", {
  sessionId,
  message: combined,
  requestId: ctx.requestId,
  locale: ctx.from?.language_code === "ru" ? "ru" : "en",  // NEW
});

// format-response.ts — УДАЛИТЬ translate логику
export async function formatResponse(converseResp: ConverseResponse): Promise<string> {
  const { message } = converseResp;
  return message;  // Уже на нужном языке!
}
```

---

## Обязательные файлы к прочтению

### Перед началом

```
src/facade/mcp-server/tools/converse.tool.ts          # Entry point
src/facade/services/orchestrator/flow-guard-checker.service.ts  # Hardcoded messages
src/facade/services/orchestrator/query-executor.service.ts      # Hardcoded messages
src/facade/services/orchestrator/graph-manager.service.ts       # Graph execution
src/facade/services/nlp-formatter/prompts.ts          # "Language: English"
```

### Для понимания flow

```
src/facade/langGraph/search-graph/search-graph.ts     # graph.run() pattern
src/facade/langGraph/search-graph/state.ts            # Annotation pattern
src/facade/langGraph/search-graph/nodes/show-results.ts:56  # hardcoded "ru"
src/chart/builders/html-renderer.ts:26-34             # FIELD_LABELS
```

---

## Риски и подводные камни

### 1. Telegram language_code может быть undefined или неизвестный

**Проблема:** `ctx.from.language_code` может быть `undefined`, `"uk"`, `"de"`, etc.

**Решение:** Fallback на "en":
```typescript
locale: ctx.from?.language_code === "ru" ? "ru" : "en"
```

**Проверить:** Mock ctx без language_code и с "de"

### 2. Resume из checkpoint — locale уже в state

**Проблема:** При resume locale передаётся в params, но в state может быть другой.

**Решение:** При resume используем locale из state (уже сохранён). При новом invoke — из params.

**Проверить:** Начать на "ru", resume — должен остаться "ru"

### 3. FlowGuardChecker/QueryExecutor — много сообщений

**Проблема:** 13 hardcoded сообщений нужно локализовать.

**Решение:** Создать `GUARD_PROMPTS` и `QUERY_PROMPTS` с `{language}` placeholder.

**Проверить:** Все guards на русском

### 4. NlpFormatter backward compat

**Проблема:** Существующие вызовы `format(result, graphType)` без locale.

**Решение:** Default param: `locale: Locale = "en"`

**Проверить:** Старые тесты проходят

### 5. LibreChat и другие MCP clients

**Проблема:** LibreChat не передаёт language_code как Telegram.

**Решение:** `locale` optional с default "en". LibreChat может добавить UI для выбора языка.

**Проверить:** Вызов converse без locale → English

---

## Что проверить после реализации

### Unit тесты

```bash
npm run test:unit
```

- [ ] localeSchema парсит "en", "ru", default "en"
- [ ] NlpFormatter.format() с locale param

### Integration тесты

```bash
npm run test:integration
```

- [ ] converse с locale="ru" → ответ на русском
- [ ] FlowGuardChecker с locale="ru" → guards на русском
- [ ] Chart labels на русском

### Manual тесты

1. **Русский пользователь (Telegram):**
   - language_code="ru"
   - Все ответы на русском
   - Chart labels на русском

2. **Английский пользователь:**
   - language_code="en" или undefined
   - Все ответы на английском
   - Chart labels на английском

3. **Resume checkpoint:**
   - Начать на русском
   - Перезапустить
   - Продолжить — русский сохранён в state

4. **Guards:**
   - greeting на русском
   - help на русском
   - cancel на русском

---

## Quality Gates

- [ ] `npm run lint:fix` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run test:unit` — все проходят
- [ ] `npm run test:integration` — все проходят
- [ ] Manual test: RU + EN

---

## LOC Estimate

| Компонент | LOC |
|-----------|-----|
| schemas.ts | +10 |
| converse.tool.ts | +15 |
| flow-guard-checker.service.ts | +20 |
| query-executor.service.ts | +15 |
| graph-manager.service.ts | +25 |
| 5 state.ts | +10 |
| 5 *-graph.ts | +20 |
| nlp-formatter.service.ts | +15 |
| prompts.ts | +25 |
| 3 chart nodes | +6 |
| html-renderer.ts | +20 |
| telegram converse.ts | +5 |
| telegram format-response.ts | -15 |
| **TOTAL** | **~171** |

---

## Сравнение с альтернативами

| Подход | MCP API | Edge cases | LOC | Сложность |
|--------|---------|------------|-----|-----------|
| **MCP param (этот)** | +locale | ✅ Простые | ~171 | Низкая |
| LLM Auto-Detect | 0 | ❌ Много | ~76 | Высокая |
| Hardcode "ru" | 0 | ❌ Нет EN | 0 | - |

**Выбран "MCP param"** — больше LOC, но проще архитектурно, меньше edge cases.

---

## Связанные документы

- [FEAT-037: Unified NLP Architecture](./FEAT-037-unified-nlp-architecture.md) — NlpFormatter
- [CHART-SERVICE-FINAL-DESIGN.md](../../docs/mvp_final/CHART-SERVICE-FINAL-DESIGN.md) — Chart
