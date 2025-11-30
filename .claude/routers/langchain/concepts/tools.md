# Tools - tool() Factory

**Назначение**: Создание инструментов с Zod-валидацией для агентов.

**Когда**: Любая external operation (API calls, DB queries, computations).

---

## Базовый пример

```typescript
import { tool } from "langchain";
import { z } from "zod";

const searchTool = tool(
  async ({ query }) => {
    return `Results for: ${query}`;
  },
  {
    name: "search",
    description: "Search for information on the web",
    schema: z.object({
      query: z.string().describe("The search query")
    })
  }
);
```

---

## С доступом к State (ToolRuntime)

**Рекомендуемый способ** — использовать `ToolRuntime<State>`:

```typescript
import { tool } from "langchain";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import type { ToolRuntime } from "@langchain/core/tools";

type MyState = {
  userId: string;
  phase: string;
  messages: BaseMessage[];
};

const getUserInfo = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    // ToolRuntime даёт типизированный доступ к state и toolCallId
    const { state, toolCallId } = runtime;
    const { userId, phase } = state;

    return new Command({
      update: {
        // ToolMessage ОБЯЗАТЕЛЕН для корректной работы agent
        messages: [new ToolMessage({
          content: `Got user info for ${userId}`,
          tool_call_id: toolCallId
        })]
      }
    });
  },
  {
    name: "get_user_info",
    description: "Get current user info",
    schema: z.object({})
  }
);
```

**Почему ToolRuntime?**
- Типизированный `state` — без type assertions
- `toolCallId` — нужен для ToolMessage (обязателен!)
- Чище чем `config.configurable?.__pregel_scratchpad?.currentTaskInput`

---

## С ToolMessage и Routing

```typescript
const processData = tool(
  async ({ text }, runtime: ToolRuntime<MyState>) => {
    const { state, toolCallId } = runtime;
    const validation = schema.safeParse(text);

    // ToolMessage направляет LLM на следующий tool
    return new Command({
      update: {
        phase: validation.success ? "awaiting_confirmation" : "awaiting_clarification",
        partial: validation.success ? null : text,
        messages: [new ToolMessage({
          content: validation.success
            ? "Data extracted. Now call confirm_data."
            : "Validation failed. Now call ask_clarification.",
          tool_call_id: toolCallId
        })]
      }
    });
  },
  {
    name: "process_data",
    description: "Process data. After this, call confirm_data or ask_clarification.",
    schema: z.object({ text: z.string() })
  }
);
```

**⚠️ ВАЖНО**: `goto` НЕ работает с `createAgent`! Используй ToolMessage + description.

---

## Atomic Tool Pattern

**Принцип**: ONE tool = ONE entity operation.

```typescript
// ✅ ПРАВИЛЬНО - atomic tools
const extractContext = tool(...);     // Только extraction
const askClarification = tool(...);   // Только вопросы
const confirmContext = tool(...);     // Только confirmation
const saveData = tool(...);           // Только save

// ❌ НЕПРАВИЛЬНО - orchestrator tool
const processAll = tool(async () => {
  const data = await extract();
  if (!isValid(data)) {
    await askQuestions();  // Agent не видит этот шаг!
  }
  await save(data);        // Agent не видит этот шаг!
});
```

**Преимущества**:
- Agent видит каждый шаг workflow
- Легко unit-test каждый tool
- Переиспользование tools

---

## Checklist

- [ ] ✅ Используешь `ToolRuntime<State>` для доступа к state и toolCallId
- [ ] ✅ ToolMessage в каждом Command.update.messages
- [ ] ✅ Tool description указывает следующие шаги
- [ ] ✅ Atomic tools (один tool = одна операция)
- [ ] ✅ Не используешь `goto` с `createAgent`

---

## См. также

- [glossary.md#tool](../glossary.md#tool) — API reference
- [routing.md](./routing.md) — LLM Routing через ToolMessage
- [gotchas.md#13](../reference/gotchas.md#13-command-без-toolmessage--undefined-error) — ToolMessage обязателен
- [gotchas.md#15](../reference/gotchas.md#15-goto-не-работает-с-createagent) — goto не работает
