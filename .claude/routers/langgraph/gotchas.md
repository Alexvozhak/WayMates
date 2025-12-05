# LangGraph Gotchas

Критичные ошибки с решениями.

---

## #1 Checkpointer обязателен для interrupt

```typescript
// ❌ interrupt молча игнорируется
const graph = builder.compile();

// ✅ interrupt работает
const graph = builder.compile({ checkpointer });
```

---

## #2 thread_id обязателен для persistence

```typescript
// ❌ state теряется между вызовами
await graph.invoke(input);

// ✅ state сохраняется
const config = { configurable: { thread_id: "user-123" } };
await graph.invoke(input, config);
```

---

## #3 OpenAI Structured Output: .nullable() вместо .optional()

OpenAI API (через OpenRouter) **не поддерживает** Zod `.optional()` — только `.nullable()`.

```typescript
// ❌ Ошибка: "Zod field uses .optional() without .nullable()"
const schema = z.object({
  field: z.string().optional(),
});

// ❌ Та же проблема — .partial() делает поля optional
const partialSchema = baseSchema.partial();

// ✅ Все поля T | null
import { makeNullable } from "@/shared/schemas.js";
const extractionSchema = makeNullable(baseSchema);
```

**Используй `makeNullable()`** для extraction schemas — см. `src/shared/schemas.ts`.

---

## #4 interrupt() нельзя оборачивать в try-catch

```typescript
// ❌ interrupt exception не долетит до runtime
async function node(state) {
  try {
    const response = interrupt({ question: "?" });
  } catch (err) {
    console.error(err);
  }
}

// ✅ interrupt работает
async function node(state) {
  const response = interrupt({ question: "?" });
  return { userResponse: response };
}
```

---

## #5 Router functions — код, не LLM

```typescript
// ❌ LLM решает куда идти (непредсказуемо)
async function route(state) {
  const decision = await llm.invoke("What next?");
  return decision;
}

// ✅ Код решает (детерминированно)
function route(state): string {
  if (state.errors.length > 0) return "clarify";
  return "show";
}
```

---

## #6 State reducers: lastValue vs messagesStateReducer

```typescript
// ❌ Скаляр без reducer — undefined behavior
phase: Annotation<string>,

// ✅ Скаляры — lastValue (overwrite)
phase: Annotation<string>({ reducer: lastValue, default: () => "" }),

// ✅ Массивы сообщений — messagesStateReducer (append)
messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
```

---

## #7 Node возвращает Partial, не полный state

```typescript
// ❌ Перезаписывает весь state
function node(state): StateType {
  return { ...state, phase: "next" };
}

// ✅ Обновляет только нужные поля
function node(state): Partial<StateType> {
  return { phase: "next" };
}
```

---

## #8 addConditionalEdges требует mapping объект

```typescript
// ❌ Нет mapping — непонятно какие ноды возможны
.addConditionalEdges("node", routerFn)

// ✅ Явный mapping — граф знает все возможные переходы
.addConditionalEdges("node", routerFn, {
  persist: "persist",
  edit: "extract",
  cancel: "cancel",
})
```

---

**Обновлено**: 2025-12-05
