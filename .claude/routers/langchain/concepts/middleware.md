# Middleware - humanInTheLoopMiddleware

**Назначение**: Native interrupts для user confirmations/clarifications.

**Когда**: Production workflows с human approval/review steps.

---

## Базовый пример

```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [askClarification, confirmData, saveData],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,  // Прервать на этом tool
        confirm_data: true         // Прервать на этом tool
      }
    })
  ],
  checkpointer: postgresService.getCheckpointer() // ОБЯЗАТЕЛЬНО!
});
```

**ВАЖНО**: Checkpointer ОБЯЗАТЕЛЕН ([см. glossary](../glossary.md#checkpointer-required)).

---

## Как работает

1. Agent вызывает tool (например, `ask_clarification`)
2. Middleware видит tool name в `interruptOn`
3. Middleware **прерывает** execution ДО выполнения tool
4. State сохраняется через checkpointer
5. Agent returns с `__interrupt__` field
6. User отвечает → resume через `Command({ resume })`

---

## Check interrupt

```typescript
const result = await agent.invoke({ messages: [...] }, config);

if (result.__interrupt__) {
  const interrupts = result.__interrupt__;
  // [{ value: { status: "awaiting_clarification", message: "..." } }]

  // Показываем user message
  return { status: interrupts[0].value.status, message: interrupts[0].value.message };
}
```

---

## Resume

```typescript
import { Command } from "@langchain/langgraph";

// User отвечает
const userInput = "Python, React";

// Resume
const resumeResult = await agent.invoke(
  new Command({ resume: { role: "user", content: userInput } }),
  config // ТОТ ЖЕ thread_id!
);
```

---

## Production Example

**Source**: [career-collector-agent.ts:404-408](../../../../src/facade/langchain/career-collector-agent.ts#L404)

```typescript
middleware: [
  humanInTheLoopMiddleware({
    interruptOn: { ask_clarification: true, confirm_career_data: true }
  })
]
```

---

## См. также

- [glossary.md#humanintheloopmiddleware](../glossary.md#humanintheloopmiddleware) - API reference
- [concepts/human-in-loop.md](./human-in-loop.md) - Full interrupt workflow
- [concepts/checkpointers.md](./checkpointers.md) - Setup PostgresSaver
