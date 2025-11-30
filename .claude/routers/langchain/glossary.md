# LangChain v1.0 - Glossary

**Назначение**: Термины и API reference. Критичные правила → [gotchas.md](./reference/gotchas.md).

---

## 🔴 Критичные правила (Quick Links)

| Правило | Gotcha |
|---------|--------|
| Gemini prefix `"models/"` | [#1](./reference/gotchas.md#gemini-prefix) |
| Checkpointer для interrupts | [#2](./reference/gotchas.md#checkpointer-required) |
| thread_id для persistence | [#3](./reference/gotchas.md#thread-id-persistence) |
| Command для state updates | [#4](./reference/gotchas.md#command-for-updates) |
| messages field в schema | [#5](./reference/gotchas.md#messages-field-required) |
| ToolMessage в Command | [#13](./reference/gotchas.md#13-command-без-toolmessage--undefined-error) |
| goto НЕ работает с createAgent | [#15](./reference/gotchas.md#15-goto-не-работает-с-createagent) |

---

## 📚 API Reference

### createAgent

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "models/gemini-2.0-flash",  // или ChatModel instance
  tools: [tool1, tool2],
  systemPrompt: "You are a helpful assistant",
  checkpointer: postgresService.getCheckpointer(),  // для interrupts
  stateSchema: MyStateSchema  // Zod schema
});
```

**Детали**: [concepts/agents.md](./concepts/agents.md)

---

### tool()

```typescript
import { tool } from "langchain";
import type { ToolRuntime } from "@langchain/core/tools";

const myTool = tool(
  async (params, runtime: ToolRuntime<MyState>) => {
    const { state, toolCallId } = runtime;
    return new Command({ update: {...} });
  },
  {
    name: "tool_name",
    description: "What this tool does. After this, call next_tool.",
    schema: z.object({ param1: z.string() })
  }
);
```

**Важно**: Используй `ToolRuntime<State>` для доступа к `state` и `toolCallId`.

**Детали**: [concepts/tools.md](./concepts/tools.md)

---

### Command

```typescript
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

// State update + ToolMessage (ОБЯЗАТЕЛЬНО!)
return new Command({
  update: {
    phase: "next",
    messages: [new ToolMessage({
      content: "Operation done. Now call next_tool.",
      tool_call_id: runtime.toolCallId
    })]
  }
});

// Resume из interrupt
await agent.invoke(new Command({ resume: "да, подтверждаю" }), config);
```

**⚠️ ВАЖНО**: `goto` игнорируется в `createAgent`! Используй ToolMessage + description.

---

### interrupt()

```typescript
import { interrupt } from "@langchain/langgraph";

// Внутри tool
const userMessage = interrupt({
  type: "confirmation",
  data: planData
});

// Tool НЕ парсит response! Передаёт в state:
return new Command({
  update: { userResponse: String(userMessage) }
});
```

**Рекомендация**: Agent-driven pattern — Agent сам парсит NLP.

**Детали**: [concepts/human-in-loop.md](./concepts/human-in-loop.md)

---

### PostgresSaver

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(connectionString);
await checkpointer.setup();  // Создать таблицы
```

**Cleanup**: pg_cron для автоматической очистки старых checkpoints.

---

### MessagesZodState

```typescript
import { MessagesZodState } from "@langchain/langgraph";

const MyState = z.object({
  messages: MessagesZodState.shape.messages,  // ОБЯЗАТЕЛЬНО!
  phase: z.string(),
  userResponse: z.string().optional()
});
```

---

## 🎯 Паттерны

### Agent-Driven Decision (Recommended)

**Принцип**: Agent (LLM) сам парсит NLP и решает какую tool вызвать.

```typescript
// 1. Show tool ставит на паузу (НЕ парсит!)
const showPlanTool = tool(async (_, runtime) => {
  const userMessage = interrupt({ plan: runtime.state.planData });
  return new Command({
    update: {
      userResponse: String(userMessage),
      phase: "awaiting_decision",
      messages: [new ToolMessage({
        content: `User responded: "${userMessage}"`,
        tool_call_id: runtime.toolCallId
      })]
    }
  });
});

// 2. Отдельные tools для действий
const confirmPlanTool = tool(...);   // Agent вызывает при approve
const editPlanTool = tool(...);       // Agent вызывает при edit

// 3. System prompt обучает Agent парсить NLP
systemPrompt: `
When phase="awaiting_decision":
- "да", "yes", "ok" → call confirm_plan
- "измени", "edit" → call edit_plan
YOU analyze natural language and decide!
`
```

**Детали**: [concepts/human-in-loop.md](./concepts/human-in-loop.md), [ADR-009](../../../docs/facade/decisions/ADR-009-hitl-decision-transport.md)

---

### LLM Routing (вместо goto)

**Принцип**: ToolMessage + description направляют LLM на следующий tool.

```typescript
const processTool = tool(
  async (_, runtime) => {
    const validation = schema.safeParse(data);
    return new Command({
      update: {
        phase: validation.success ? "confirmed" : "clarification",
        messages: [new ToolMessage({
          content: validation.success
            ? "Data OK. MUST call confirm_data NOW."
            : "Validation failed. MUST call ask_clarification NOW.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  {
    name: "process_data",
    description: "Process data. After this, call confirm_data or ask_clarification."
  }
);
```

**⚠️**: `goto` НЕ работает с `createAgent`! Используй этот паттерн.

**Детали**: [concepts/routing.md](./concepts/routing.md)

---

### Multi-Round Clarification

```typescript
const extractTool = tool(async (_, runtime) => {
  const { partialContext, clarificationRound = 0 } = runtime.state;
  const validation = schema.safeParse(merged);

  if (!validation.success) {
    const round = clarificationRound + 1;
    if (round > MAX_ROUNDS) {
      return new Command({ update: { phase: "failed" } });
    }
    return new Command({
      update: {
        partialContext: merged,
        clarificationRound: round,
        phase: "awaiting_clarification",
        messages: [new ToolMessage({
          content: "Need more info. Call ask_clarification.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  }
  // Success...
});
```

**Защита**: Max rounds предотвращает бесконечные циклы.

---

## 🔗 Cross-references

- [gotchas.md](./reference/gotchas.md) — Критичные ошибки с решениями
- [concepts/](./concepts/) — Детальные заметки
- [ADR-009](../../../docs/facade/decisions/ADR-009-hitl-decision-transport.md) — Production решение для HITL
