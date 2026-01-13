---
description: "Миграция агентов с createAgent на LangGraph StateGraph (upsert-trail, upsert-context, update-context)"
allowed-tools: ["Read", "Edit", "Write", "Task", "AskUserQuestion", "Bash", "TodoWrite", "Glob", "Grep"]
---

# 🔄 Миграция агентов на LangGraph

## Цель

Мигрировать оставшиеся агенты с `createAgent` на LangGraph StateGraph для консистентности с cold-start-v2.

**Причина**: createAgent недетерминированно вызывал tools (иногда несколько одновременно).

**Порядок**: shared → upsert-trail → upsert-context → update-context → cleanup

**Критерий успеха**: Все integration тесты проходят стабильно.

---

## Обязательный контекст

**ПЕРЕД началом работы** прочитай документацию по LangGraph:

### Исследование и архитектура (docs/research/langgraph-migration/)

1. **Summary**: `00-summary-report.md` — краткий обзор миграции
2. **Текущее состояние**: `01-current-state-analysis.md` — анализ createAgent
3. **LangGraph архитектура**: `02-langgraph-architecture.md` — паттерны StateGraph
4. **Сравнение**: `03-langchain-vs-langgraph.md` — почему LangGraph лучше
5. **Persistence**: `04-persistence-checkpointing.md` — checkpointer и interrupt
6. **Architecture Review**: `ARCHITECTURE-REVIEW.md` — детальный разбор
7. **План миграции**: `MIGRATION-PLAN.md` — пошаговый план

### Референсная реализация

8. **cold-start-v2**: `src/facade/langchain/cold-start-v2/` — рабочий граф
9. **Extraction schemas**: `src/facade/langchain/shared-tools/extraction-models.ts`

### План текущей миграции

10. **Согласованный план**: `docs/research/langgraph-migration/MIGRATION-PLAN-V2.md`

---

## Phase 1: Создание shared/ модуля

### Структура

```
src/facade/langchain/shared/
├── index.ts
├── decision.ts      # decisionSchema + parseDecision + CONFIRMATION_PROMPT
└── state-utils.ts   # lastValue reducer
```

### Файлы для создания

**decision.ts** — схема парсинга intent пользователя:
- `decisionSchema` с полями `intent`, `editTarget`, `editInstructions`
- `CONFIRMATION_PROMPT` — универсальный промпт (работает с любым языком)
- `parseDecision<T>()` — функция-node для использования в графах

**state-utils.ts**:
- `lastValue` reducer — для скалярных полей state

### Проверка

```bash
npx tsc --noEmit
npm run lint:fix
```

---

## Phase 2: upsert-trail граф

### Структура

```
src/facade/langchain/upsert-trail/
├── index.ts
├── state.ts
├── types.ts
├── prompts.ts
├── response-builders.ts
├── nodes/
│   ├── index.ts
│   ├── extract-trail.ts
│   ├── validate-trail.ts
│   ├── show-trail.ts
│   ├── parse-decision.ts
│   ├── edit-trail.ts
│   ├── persist-trail.ts
│   └── cancel.ts
├── routers/
│   ├── index.ts
│   └── trail-router.ts
└── upsert-trail-graph.ts
```

### Граф

```
START → extract_trail → validate_trail → show_trail → parse_decision →
  approve: persist_trail → END
  edit: edit_trail → validate_trail
  cancel: cancel → END
```

### Ключевые моменты

1. **State** содержит `fromContextId` (текущий контекст пользователя)
2. **extractableTrailSchema** уже существует в `shared-tools/extraction-models.ts`
3. **trailId** генерируется в `validate-trail` через `trl_${uuidv7()}`
4. **toContextId** всегда `null` (тропа к будущему навыку)

### MCP Tool обновление

Обновить `src/facade/mcp-server/tools/upsert-trail.tool.ts`:
- Получить `fromContextId` через `getStory`
- Создать `UpsertTrailGraph(userId, fromContextId)`
- После `saved` — нормализовать skill и сохранить

### Проверка

```bash
npx tsc --noEmit
npm run lint:fix
# Создать и запустить integration тест
```

---

## Phase 3: upsert-context-v2 граф

### Структура

```
src/facade/langchain/upsert-context-v2/
├── index.ts
├── state.ts
├── nodes/
│   ├── extract-context.ts
│   ├── validate-context.ts
│   ├── show-context.ts
│   ├── parse-decision.ts
│   ├── edit-context.ts
│   ├── persist-context.ts
│   └── cancel.ts
├── routers/
│   └── context-router.ts
└── upsert-context-graph.ts
```

### Что переиспользовать

- `types.ts` → из `upsert-context/types.ts`
- `prompts.ts` → из `upsert-context/prompts.ts`
- `response-builders.ts` → из `upsert-context/response-builders.ts`
- `parseDecision` → из `shared/`

### MCP Tool обновление

Обновить `src/facade/mcp-server/tools/upsert-context.tool.ts`:
- Заменить `UpsertContextWorkflow` на `UpsertContextGraph`

### Проверка

```bash
npx tsc --noEmit
npm run lint:fix
# Адаптировать и запустить tests/facade/agents/upsert-context/integration/
```

---

## Phase 4: update-context-v2 граф

### Отличия от upsert-context

- State содержит `currentContext` (существующий контекст)
- Extraction извлекает diff (изменения), а не полный контекст
- Show показывает before/after

### Дополнительные поля state

```typescript
currentContext: Annotation<UserContext>({ reducer: lastValue }),
extractedUpdates: Annotation<Partial<UserContext> | null>({ reducer: lastValue, default: () => null }),
mergedContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
```

### MCP Tool обновление

Обновить `src/facade/mcp-server/tools/update-context.tool.ts`:
- Заменить `UpdateContextWorkflow` на `UpdateContextGraph`

### Проверка

```bash
npx tsc --noEmit
npm run lint:fix
# Адаптировать и запустить tests/facade/agents/update-context/integration/
```

---

## Phase 5: Удаление старого кода

После успешной миграции и прохождения всех тестов:

### Удалить

```
src/facade/langchain/cold-start/                    # Рудимент
src/facade/langchain/upsert-context/                # Заменён на v2
src/facade/langchain/update-context/                # Заменён на v2
src/facade/langchain/shared-tools/agent-workflow.ts # Больше не нужен
src/facade/langchain/shared-tools/guards.ts         # Граф гарантирует фазы
```

### Переименовать

```
upsert-context-v2 → upsert-context
update-context-v2 → update-context
```

### Финальная проверка

```bash
npx tsc --noEmit
npm run lint:fix
npm run test:integration
```

---

## Ключевые паттерны

### State Definition

```typescript
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { lastValue, type ParsedDecision } from "../shared/index.js";

export const stateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  phase: Annotation<Phase>({ reducer: lastValue, default: () => PHASE.extracting }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),
});
```

### Interrupt Node

```typescript
import { interrupt } from "@langchain/langgraph";

export function showNode(state: StateType): Partial<StateType> {
  const userResponse = interrupt({
    type: "confirmation",
    data: state.validatedData,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaiting_confirmation,
  });
  return { userResponse: String(userResponse) };
}
```

### Parse Decision (из shared)

```typescript
import { parseDecision } from "../shared/index.js";

export const parseDecisionNode = (state: StateType) => parseDecision(state);
```

### Router Function (КОД, не LLM!)

```typescript
export function routeAfterDecision(state: StateType): string {
  switch (state.parsedDecision?.intent) {
    case "approve": return "persist";
    case "edit": return "edit";
    case "cancel": return "cancel";
    default: return "show";
  }
}
```

### Graph Builder

```typescript
function createGraphBuilder() {
  return new StateGraph(stateAnnotation)
    .addNode("extract", extractNode)
    .addNode("validate", validateNode)
    .addNode("show", showNode)
    .addNode("parse_decision", parseDecisionNode)
    .addNode("edit", editNode)
    .addNode("persist", persistNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract")
    .addEdge("extract", "validate")
    .addEdge("validate", "show")
    .addEdge("show", "parse_decision")
    .addConditionalEdges("parse_decision", routeAfterDecision, {
      persist: "persist",
      edit: "edit",
      cancel: "cancel",
      show: "show",
    })
    .addEdge("edit", "validate")
    .addEdge("persist", END)
    .addEdge("cancel", END);
}
```

---

## Проверка после каждого этапа

```bash
# TypeScript compilation
npx tsc --noEmit

# Lint
npm run lint:fix
```

---

## Если что-то идёт не так

1. **Structured output fails** → проверь что все поля в Zod schema REQUIRED (не .optional())
2. **Routing неправильный** → проверь router function, добавь console.log
3. **State не обновляется** → проверь reducer (lastValue vs messagesStateReducer)
4. **Interrupt не работает** → убедись что checkpointer подключен

**Debug через LangSmith**:
```bash
LANGSMITH_TRACING=true \
LANGSMITH_PROJECT=waymates-migration \
LANGSMITH_API_KEY=xxx \
npx vitest tests/facade/agents/upsert-trail/integration/
```

---

## Не делай

- ❌ Не модифицируй старый код в `upsert-context/`, `update-context/` до завершения миграции
- ❌ Не используй `.optional()` в Zod schemas для structured output
- ❌ Не полагайся на промпт для routing — только код
- ❌ Не создавай дублирующие types — переиспользуй существующие

---

## Ссылки

- **План миграции**: `docs/research/langgraph-migration/MIGRATION-PLAN-V2.md`
- **Референс**: `src/facade/langchain/cold-start-v2/`
- **Extraction schemas**: `src/facade/langchain/shared-tools/extraction-models.ts`

ARGUMENTS: $ARGUMENTS
