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

## Сигнатура tool function

**Второй параметр** - это `config` объект, который LangChain передаёт при вызове tool.

```typescript
// Источник: node_modules/langchain/dist/agents/nodes/ToolNode.js:164-170
// ToolNode вызывает tool.invoke так:
await tool.invoke(toolCall, {
  ...config,
  toolCallId: toolCall.id,
  state: config.configurable?.__pregel_scratchpad?.currentTaskInput,  // ← state агента!
});
```

**Правильная типизация:**

```typescript
// Вариант 1: Partial типизация только нужных полей
const myTool = tool(
  async (input, config: { state: MyAgentState }) => {
    const { messages, userId } = config.state;
    // ...
  },
  { name: "my_tool", schema: z.object({...}) }
);

// Вариант 2: С деструктуризацией
const myTool = tool(
  async (input, { state }: { state: MyAgentState }) => {
    const { messages } = state;
    // ...
  },
  { name: "my_tool", schema: z.object({...}) }
);

// Вариант 3: Без state (если не нужен)
const myTool = tool(
  async ({ query }) => {
    return `Results for: ${query}`;
  },
  { name: "my_tool", schema: z.object({ query: z.string() }) }
);
```

**Важно**: Имя параметра `config` (не `toolConfig`) - это convention из LangChain.

---

## С Command для routing

```typescript
import { Command } from "@langchain/langgraph";

const extractData = tool(
  async ({ text }, { state }: { state: AgentState }) => {
    const validation = schema.safeParse(data);

    if (!validation.success) {
      return new Command({
        update: { partial: data },
        goto: "ask_clarification"
      });
    }

    return new Command({
      update: { data: validation.data },
      goto: "confirm_data"
    });
  },
  {
    name: "extract_data",
    description: "Extract and validate data",
    schema: z.object({
      text: z.string().describe("Text to extract from")
    })
  }
);
```

**См**: [concepts/routing.md](./routing.md) - Explicit routing через goto.

---

## Доступ к state

```typescript
type AgentState = {
  userId: string;
  messages: BaseMessage[];
};

// Рекомендуемый способ - деструктуризация
const getUserInfo = tool(
  async (_, { state }: { state: AgentState }) => {
    const { userId } = state;
    return { userId };
  },
  {
    name: "get_user_info",
    description: "Get current user info",
    schema: z.object({})
  }
);
```

---

## Atomic Tool Pattern

**Принцип**: ONE tool = ONE entity operation.

```typescript
// ✅ ПРАВИЛЬНО - atomic tools
const extractUserContext = tool(...);  // Только extraction + validation
const askClarification = tool(...);    // Только вопросы
const confirmCareerData = tool(...);   // Только confirmation
const saveCareerData = tool(...);      // Только save to DB

// ❌ НЕПРАВИЛЬНО - orchestrator tool
const processCareerData = tool(async () => {
  const data = await extract();
  if (!isValid(data)) {
    await askQuestions();  // Agent не видит этот шаг!
  }
  await save(data);        // Agent не видит этот шаг!
});
```

**См**: [patterns/atomic-tools.md](../patterns/atomic-tools.md) - Полный паттерн.

---

## См. также

- [glossary.md#tool](../glossary.md#tool) - API reference
- [concepts/routing.md](./routing.md) - Command + goto routing
- [patterns/atomic-tools.md](../patterns/atomic-tools.md) - Atomic tools pattern
