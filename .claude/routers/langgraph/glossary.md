# LangGraph Glossary

API справочник для используемого синтаксиса. Верифицировано через Context7.

---

## State Definition

```typescript
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

const lastValue = <T>(_prev: T, next: T): T => next;

export const stateAnnotation = Annotation.Root({
  // Массивы — messagesStateReducer (append)
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),

  // Скаляры — lastValue (overwrite)
  phase: Annotation<Phase>({ reducer: lastValue, default: () => "initial" }),
  userId: Annotation<string>({ reducer: lastValue, default: () => "" }),

  // Nullable — для optional данных
  extractedData: Annotation<Data | null>({ reducer: lastValue, default: () => null }),
});

export type StateType = typeof stateAnnotation.State;
```

---

## Graph Building

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";

function createGraphBuilder() {
  return new StateGraph(stateAnnotation)
    .addNode("extract", extractNode)
    .addNode("validate", validateNode)
    .addNode("show", showNode)
    .addNode("persist", persistNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract")
    .addEdge("extract", "validate")
    .addConditionalEdges("validate", routeAfterValidation, {
      show: "show",
      cancel: "cancel",
    })
    .addEdge("show", "parse_decision")
    .addConditionalEdges("parse_decision", routeAfterDecision, {
      persist: "persist",
      edit: "extract",
      cancel: "cancel",
    })
    .addEdge("persist", END)
    .addEdge("cancel", END);
}

const graph = createGraphBuilder().compile({ checkpointer });
```

---

## Interrupt / Resume

```typescript
import { interrupt } from "@langchain/langgraph";
import { Command } from "@langchain/langgraph";

// Node с interrupt
function showNode(state: StateType): Partial<StateType> {
  const userResponse = interrupt({
    type: "confirmation",
    data: state.extractedData,
    phase: "awaiting_confirmation",
  });
  return { userResponse: String(userResponse) };
}

// Execution
const config = { configurable: { thread_id: threadId } };
const snapshot = await graph.getState(config);
const hasPending = snapshot.tasks.length > 0;

const result = hasPending
  ? await graph.invoke(new Command({ resume: message }), config)
  : await graph.invoke(initialState, config);
```

---

## Router Functions

```typescript
// Детерминированные — без LLM
export function routeAfterValidation(state: StateType): string {
  if (state.validationErrors.length > 0) return "clarify";
  return "show";
}

export function routeAfterDecision(state: StateType): string {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": return "persist";
    case "edit": return "extract";
    case "cancel": return "cancel";
    default: return "show";
  }
}
```

---

## Structured Output (Intent Parsing)

```typescript
import { z } from "zod";

const decisionSchema = z.object({
  intent: z.enum(["approve", "edit", "cancel"]),
  editTarget: z.string(),
  editInstructions: z.string(),
});

const parser = model.withStructuredOutput(decisionSchema);
const decision = await parser.invoke([
  { role: "system", content: PROMPT },
  { role: "user", content: state.userResponse },
]);
```

---

## Compile & Execute

```typescript
// Singleton pattern
let compiledGraphCache: CompiledGraph | null = null;

function getCompiledGraph(): CompiledGraph {
  if (!compiledGraphCache) {
    const checkpointer = postgresService.getCheckpointer();
    compiledGraphCache = createGraphBuilder().compile({ checkpointer });
  }
  return compiledGraphCache;
}

// Reset для тестов
export function resetCheckpointer(): void {
  compiledGraphCache = null;
}
```

---

**Обновлено**: 2025-12-05
