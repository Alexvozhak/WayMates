# Agents - createAgent API

**Назначение**: Упрощенный API для создания агентов в LangChain v1.0.

**Когда**: Production-ready agents с tools, middleware, checkpointing.

---

## Базовый пример

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [searchTool, weatherTool],
  systemPrompt: "You are a helpful assistant."
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }]
});
```

---

## Параметры

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `string \| ChatModel` | ✅ | Название модели или instance |
| `tools` | `Tool[]` | ❌ | Массив tool объектов |
| `systemPrompt` | `string \| function` | ❌ | System prompt (static или dynamic) |
| `middleware` | `Middleware[]` | ❌ | humanInTheLoopMiddleware и др |
| `checkpointer` | `PostgresSaver` | ❌ | Для interrupts + persistence |
| `stateSchema` | `ZodSchema` | ❌ | Custom state schema (Zod) |

---

## С checkpointer и middleware

```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { postgresService } from "./infrastructure/postgres.service.js";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [askClarification, confirmData],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { ask_clarification: true, confirm_data: true }
    })
  ],
  checkpointer: postgresService.getCheckpointer(), // Для interrupts
  systemPrompt: "You are a career data collector."
});
```

**ВАЖНО**: Checkpointer ОБЯЗАТЕЛЕН для humanInTheLoopMiddleware ([см. glossary](../glossary.md#checkpointer-required)).

---

## Dynamic system prompt

```typescript
const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [searchTool],
  systemPrompt: (state) => {
    const userName = state.userName || "User";
    return `You are a helpful assistant for ${userName}.`;
  }
});
```

---

## См. также

- [glossary.md#createagent](../glossary.md#createagent) - API reference
- [concepts/tools.md](#) - Создание tools
- [concepts/middleware.md](#) - Middleware для interrupts
- [concepts/checkpointers.md](#) - Setup PostgresSaver
