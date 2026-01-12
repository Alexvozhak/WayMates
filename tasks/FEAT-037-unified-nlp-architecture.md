# FEAT-037: Унификация NLP архитектуры Facade → Client

## Статус: READY FOR IMPLEMENTATION

## Суть изменения

**Было:** GraphManager возвращает JSON, Telegram форматирует через LLM (3 Presenter'а).

**Будет:** GraphManager возвращает NLP, Telegram только переводит (1 Translator).

---

## План реализации

### Фаза 1: NlpFormatter в Facade (~130 LOC)

#### 1.1 Создать промпты для каждого графа

**Файл:** `src/facade/services/nlp-formatter/prompts.ts`

```typescript
export const GRAPH_PROMPTS: Record<GraphType, string> = {
  search: `...`,        // ~25 LOC — цели, кандидаты, фильтры
  cold_start: `...`,    // ~20 LOC — сбор истории, план, подтверждения
  upsert_context: `...`, // ~15 LOC — добавление контекста
  update_context: `...`, // ~15 LOC — обновление контекста
  upsert_trail: `...`,   // ~15 LOC — добавление trail
};
```

**Источник:** Скопировать из `telegram-bot/presenters/` и адаптировать.

#### 1.2 Создать сервис NlpFormatter

**Файл:** `src/facade/services/nlp-formatter/nlp-formatter.service.ts`

```typescript
export class NlpFormatter {
  constructor(private readonly llm: ChatOpenAI) {}

  async format(result: AnyGraphResponse, graphType: GraphType): Promise<string>;
}
```

**~40 LOC:** конструктор, format(), buildPrompt().

#### 1.3 Создать index.ts

**Файл:** `src/facade/services/nlp-formatter/index.ts`

```typescript
export { NlpFormatter } from "./nlp-formatter.service.js";
export { GRAPH_PROMPTS } from "./prompts.js";
```

---

### Фаза 2: Интеграция в GraphManager (~20 LOC)

**Файл:** `src/facade/services/orchestrator/graph-manager.service.ts`

#### 2.1 Добавить NlpFormatter в зависимости

```typescript
export class GraphManager {
  private readonly nlpFormatter: NlpFormatter;

  constructor(private readonly deps: GraphDeps) {
    this.nlpFormatter = new NlpFormatter(deps.llm);
  }
}
```

#### 2.2 Изменить метод run()

```typescript
private async run(input: GraphInput): Promise<ConverseResponse> {
  const result = await this.executeGraph(input, threadId);

  if (TERMINAL_PHASES.has(result.phase)) {
    await this.deps.checkpointService.delete(threadId);
  }

  // NEW: JSON → NLP
  const nlpMessage = await this.nlpFormatter.format(result, input.type);
  return createSystemMessage(nlpMessage);
}
```

#### 2.3 Удалить createGraphResponse

Больше не нужен — все возвращают `createSystemMessage()`.

---

### Фаза 3: Добавить message в SearchGraph (~20 LOC)

**Файл:** `src/facade/langGraph/search-graph/response-builders.ts`

Добавить `message` field в каждую фазу (как в ColdStart):

```typescript
[PHASE.showing_results]: (state) => ({
  phase: PHASE.showing_results,
  message: "Here are people who achieved your goal.",  // NEW
  results: state.searchResults,
  // ...
}),
```

**Фазы для добавления message:**
- showing_exploration
- showing_goal
- clarifying_goal
- asking_after_validate
- showing_results
- advising
- cancelled
- failed

---

### Фаза 4: Упрощение Telegram (~-200 LOC)

#### 4.1 Удалить Presenter'ы

```bash
rm src/telegram-bot/presenters/search-graph-presenter.ts
rm src/telegram-bot/presenters/crud-graph-presenter.ts
```

#### 4.2 Упростить base-presenter.ts → translator.ts

**Файл:** `src/telegram-bot/presenters/translator.ts` (переименовать)

Оставить только translate логику (~30 LOC):

```typescript
export class Translator {
  async translate(text: string, languageCode?: string): Promise<string>;
}
```

#### 4.3 Упростить format-response.ts

```typescript
export async function formatResponse(
  resp: ConverseResponse,
  translator: Translator,
  lang?: string
): Promise<string> {
  // Всё уже NLP — просто перевести
  const content = resp.result.phase === "system_message"
    ? resp.result.content
    : resp.result.message;

  return await translator.translate(content, lang);
}
```

#### 4.4 Обновить types.ts

Убрать `SearchGraphPresenter`, `CrudGraphPresenter` из `BotServices`.

---

### Фаза 5: Тесты и проверка

#### 5.1 Unit тесты NlpFormatter

**Файл:** `tests/facade/unit/nlp-formatter.spec.ts`

- Проверить что каждый граф имеет промпт
- Проверить формат output (не пустой, содержит ключевые данные)

#### 5.2 Integration тесты

```bash
npm run test:facade:run  # должны проходить
npm run test:telegram:run  # обновить после упрощения
```

#### 5.3 Quality gates

```bash
npm run lint:fix
npx tsc --noEmit
```

---

## Чеклист

### Фаза 1: NlpFormatter
- [ ] `src/facade/services/nlp-formatter/prompts.ts`
- [ ] `src/facade/services/nlp-formatter/nlp-formatter.service.ts`
- [ ] `src/facade/services/nlp-formatter/index.ts`

### Фаза 2: GraphManager
- [ ] Добавить NlpFormatter в конструктор
- [ ] Изменить `run()` — вызов format + createSystemMessage
- [ ] Удалить `createGraphResponse` из converse-response.ts

### Фаза 3: SearchGraph
- [ ] Добавить message в response-builders.ts (8 фаз)
- [ ] Обновить schema если нужно

### Фаза 4: Telegram
- [ ] Удалить search-graph-presenter.ts
- [ ] Удалить crud-graph-presenter.ts
- [ ] Переименовать base-presenter.ts → translator.ts
- [ ] Упростить format-response.ts
- [ ] Обновить types.ts
- [ ] Обновить index.ts (экспорты)

### Фаза 5: Проверка
- [ ] `npm run lint:fix` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run test:facade:run` — all passing
- [ ] `npm run test:telegram:run` — all passing

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Facade + | ~165 LOC |
| Telegram - | ~200 LOC |
| Net | -35 LOC |
| Файлов создать | 3 |
| Файлов удалить | 2 |
| Файлов изменить | ~6 |
| Риск | Низкий (перенос логики) |

---

## Результат

- ✅ Единый API: все executor'ы возвращают NLP
- ✅ Telegram = thin client (только translate)
- ✅ 5 промптов по графам (единообразно)
- ✅ Новые MCP клиенты получают готовый NLP

---

## Changelog

| Дата | Изменение |
|------|-----------|
| 2025-12-22 | Создана задача на проработку |
| 2025-12-23 | Финализирован план, статус READY FOR IMPLEMENTATION |
