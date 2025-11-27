# State Management - Custom State Schema

**Назначение**: Определение state schema для агентов с Zod.

**Когда**: Custom fields кроме messages (status, counters, partial data).

---

## Базовый пример (только messages)

```typescript
import { MessagesZodState } from "@langchain/langgraph";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [...],
  stateSchema: MessagesZodState // Только messages field
});
```

---

## Custom state schema

```typescript
import { z } from "zod";
import { MessagesZodState } from "@langchain/langgraph";

const MyStateSchema = z.object({
  messages: MessagesZodState.shape.messages, // ОБЯЗАТЕЛЬНО!
  partialContext: userContextSchemaPartial.optional(),
  contexts: z.array(userContextSchema).optional(),
  status: z.enum([
    "collecting",
    "awaiting_clarification",
    "awaiting_confirmation",
    "complete",
    "failed"
  ]).optional(),
  clarificationRound: z.number().default(0),
  userId: z.string().optional()
});

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [...],
  stateSchema: MyStateSchema
});
```

**ВАЖНО**: `messages` field ОБЯЗАТЕЛЕН ([см. glossary](../glossary.md#messages-field-required)).

---

## Доступ к state в tool

```typescript
type AgentState = z.infer<typeof MyStateSchema>;

const myTool = tool(
  async (params, toolConfig: { state: AgentState }) => {
    const { partialContext, clarificationRound, userId } = toolConfig.state;
    // Читаем custom fields из state
    return new Command({
      update: {
        partialContext: updatedPartial,
        clarificationRound: clarificationRound + 1
      }
    });
  },
  { name: "my_tool", description: "...", schema: z.object({...}) }
);
```

---

## Production Example

**Source**: [career-collector-agent.ts:296-307](../../../../src/facade/langchain/career-collector-agent.ts#L296)

```typescript
const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  partialContext: userContextSchemaPartial.optional(),
  contexts: z.array(userContextSchema).optional(),
  trails: z.array(trailSchema).optional(),
  status: z.enum([...]).optional(),
  message: z.string().optional(),
  clarificationRound: z.number().default(0),
  userId: z.string().optional()
});
```

---

## См. также

- [glossary.md#messageszodstate](../glossary.md#messageszodstate) - Messages field
- [concepts/human-in-loop.md](./human-in-loop.md) - Multi-round state accumulation
