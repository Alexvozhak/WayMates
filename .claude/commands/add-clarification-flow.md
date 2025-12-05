---
description: "Добавить clarification flow в LangGraph агент (upsert-context, upsert-trail)"
allowed-tools: ["Read", "Edit", "Write", "Task", "AskUserQuestion", "Bash", "TodoWrite", "Glob", "Grep"]
---

# 🔄 Добавление Clarification Flow

## Цель

Добавить clarification flow в агенты upsert-context и upsert-trail для унификации с cold-start-v2.

**Проблема**: При null в required поле агент сразу падает (`failed`), вместо уточнения у пользователя.

**Решение**: Паттерн cold-start-v2 — `makeNullable()` + clarification loop.

---

## Обязательный контекст

**ПЕРЕД началом работы** прочитай:

### LangGraph документация
1. **Router**: `.claude/routers/langgraph/router.md`
2. **API**: `.claude/routers/langgraph/glossary.md`
3. **Gotchas**: `.claude/routers/langgraph/gotchas.md` (особенно #3: makeNullable)

### Референсная реализация (cold-start-v2)
4. **Validate node**: `src/facade/langchain/cold-start-v2/nodes/validate-context.ts`
5. **Clarify node**: `src/facade/langchain/cold-start-v2/nodes/clarify.ts`
6. **Types**: `src/facade/langchain/cold-start/types.ts` (MissingField schema)

### Текущий план (если есть)
7. **Plan file**: `PLAN-clarification-flow.md` (в корне проекта)

---

## Паттерн Clarification Flow

### State additions

```typescript
import type { MissingField } from "../cold-start/types.js";

// Добавить в state:
missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),

// Добавить phase:
awaitingClarification: "awaiting_clarification",
```

### Validate node pattern

```typescript
import { extractMissingFields } from "../cold-start-v2/nodes/validate-context.js";
import { config } from "../../env.js";

const MAX_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

export function validateNode(state): Partial<State> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const missing = extractMissingFields(result, entityLabel, entityType);

    if (state.clarificationRound + 1 > MAX_ROUNDS) {
      return { phase: PHASE.failed, validationErrors: [...] };
    }

    return {
      phase: PHASE.awaitingClarification,
      missingFields: missing,
      clarificationRound: state.clarificationRound + 1,
    };
  }

  return { validatedData: result.data, missingFields: [], clarificationRound: 0 };
}
```

### Clarify node pattern

```typescript
import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

export function clarifyNode(state): Partial<State> {
  const questions = state.missingFields.map((mf) => ({
    field: mf.field,
    entityLabel: mf.entityLabel,
    entityType: mf.entityType,
    message: mf.zodMessage,
  }));

  const userResponse = interrupt({
    type: "clarification",
    message: "Please provide missing information:",
    questions,
    phase: PHASE.awaitingClarification,
  });

  return {
    userResponse: String(userResponse),
    messages: [new HumanMessage(String(userResponse))],
  };
}
```

### Router pattern

```typescript
export function routeAfterValidation(state): string {
  if (state.phase === "failed") return "cancel";
  if (state.missingFields.length > 0) return "clarify";
  return "show_entity";
}
```

### Graph edges

```typescript
.addNode("clarify", clarifyNode)
.addConditionalEdges("validate", routeAfterValidation, {
  clarify: "clarify",
  show_entity: "show_entity",
  cancel: "cancel",
})
.addEdge("clarify", "extract")  // loop back for re-extraction
```

---

## Порядок работы

### Phase 1: upsert-context (8 файлов)

1. `state.ts` — добавить `missingFields`, `clarificationRound`, phase
2. `types.ts` — добавить response variant для `awaitingClarification`
3. `nodes/validate-context.ts` — использовать `extractMissingFields`
4. `nodes/clarify.ts` — **NEW** (скопировать паттерн)
5. `nodes/index.ts` — добавить export
6. `routers/context-router.ts` — обновить `routeAfterValidation`
7. `upsert-context-graph.ts` — добавить node и edges
8. `response-builders.ts` — добавить builder

**Проверка**: `npm run lint && npx tsc --noEmit`

### Phase 2: upsert-trail (12 файлов)

1. `src/shared/schemas.ts` — добавить `trailSchemaBase`
2. `extraction-models.ts` — использовать `makeNullable(trailSchemaBase)`
3. `state.ts` — добавить clarification fields
4. `types.ts` — добавить response variants
5. `nodes/validate-trail.ts` — использовать `extractMissingFields`
6. `nodes/clarify.ts` — **NEW**
7. `nodes/index.ts` — добавить export
8. `routers/trail-router.ts` — обновить router
9. `upsert-trail-graph.ts` — добавить node и edges
10. `response-builders.ts` — добавить builder
11. `src/facade/mcp-server/schemas.ts` — params: `message` вместо `trail`
12. `src/facade/mcp-server/tools/upsert-trail.tool.ts` — подключить graph

**Проверка**: `npm run lint && npx tsc --noEmit`

---

## Критичные правила

### makeNullable обязателен для extraction schema

```typescript
// ❌ OpenAI API вернёт ошибку при null
const schema = baseSchema.omit({ id: true });

// ✅ Все поля становятся T | null
const extractableSchema = makeNullable(baseSchema.omit({ id: true }));
```

### extractMissingFields переиспользуй

Не создавай новую реализацию — импортируй из cold-start-v2:

```typescript
import { extractMissingFields } from "../cold-start-v2/nodes/validate-context.js";
```

### interrupt нельзя в try-catch

```typescript
// ❌ Сломает interrupt
try {
  const response = interrupt({ ... });
} catch (e) { ... }

// ✅ Правильно
const response = interrupt({ ... });
```

---

## Если что-то идёт не так

1. **OpenAI API fails с null** → проверь что schema использует `makeNullable()`
2. **Clarification не срабатывает** → проверь router function, добавь console.log
3. **Бесконечный loop** → проверь `MAX_CLARIFICATION_ROUNDS` и `clarificationRound`
4. **State не обновляется** → проверь что возвращаешь `Partial<State>`

**Debug**: Читай trace в LangSmith (если включен).

---

## Не делай

- ❌ Не создавай дублирующие types — используй `MissingField` из cold-start
- ❌ Не пиши новую `extractMissingFields` — импортируй существующую
- ❌ Не запускай тесты без явной просьбы
- ❌ Не частий с lint/tsc — запускай после завершения каждого агента

---

## Ссылки

- **LangGraph docs**: `.claude/routers/langgraph/`
- **Reference**: `src/facade/langchain/cold-start-v2/`
- **Plan**: `.claude/plans/sorted-shimmying-pelican.md`

ARGUMENTS: $ARGUMENTS
