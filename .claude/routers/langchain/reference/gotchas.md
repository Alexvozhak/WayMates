# LangChain v1.0 - Common Gotchas

**Назначение**: Критичные ошибки и быстрые решения. Дубликаты удалены → см. [glossary.md](../glossary.md).

**Когда читать**: Перед запуском в production, при debugging непонятных ошибок.

---

## 🔴 Critical Gotchas

### <a id="gemini-prefix"></a>#1: Gemini Model Names

**Правило**: [glossary.md#gemini-prefix](../glossary.md#gemini-prefix)

```typescript
// ❌ НЕПРАВИЛЬНО - не работает
model: "gemini-2.0-flash"

// ✅ ПРАВИЛЬНО
model: "models/gemini-2.0-flash"
```

**Quick Fix**: Всегда добавляй prefix `"models/"` для Gemini моделей.

---

### <a id="checkpointer-required"></a>#2: Missing Checkpointer для Interrupts

**Правило**: [glossary.md#checkpointer-required](../glossary.md#checkpointer-required)

```typescript
// ❌ НЕПРАВИЛЬНО - interrupts не работают
const agent = createAgent({
  middleware: [humanInTheLoopMiddleware({ interruptOn: { confirm: true } })]
  // НЕТ checkpointer!
});

// ✅ ПРАВИЛЬНО
const agent = createAgent({
  middleware: [humanInTheLoopMiddleware({ interruptOn: { confirm: true } })],
  checkpointer: postgresService.getCheckpointer() // ОБЯЗАТЕЛЬНО!
});
```

**Quick Fix**: Добавь checkpointer ИЛИ удали humanInTheLoopMiddleware.

**Детали**: [concepts/checkpointers.md](../concepts/checkpointers.md)

---

### <a id="thread-id-persistence"></a>#3: Missing thread_id

**Правило**: [glossary.md#thread-id-persistence](../glossary.md#thread-id-persistence)

```typescript
// ❌ НЕПРАВИЛЬНО - state теряется
await agent.invoke({ messages: [...] });

// ✅ ПРАВИЛЬНО
const config = { configurable: { thread_id: "session-123" } };
await agent.invoke({ messages: [...] }, config);
```

**Quick Fix**: Всегда передавай `thread_id` в `configurable` для persistence.

**Детали**: [concepts/checkpointers.md](../concepts/checkpointers.md)

---

### <a id="command-for-updates"></a>#4: State Updates без Command

**Правило**: [glossary.md#command-for-updates](../glossary.md#command-for-updates)

```typescript
// ❌ НЕПРАВИЛЬНО - state не обновится
return { phase: "locked", data: result };

// ✅ ПРАВИЛЬНО
import { Command } from "@langchain/langgraph";
return new Command({
  update: { phase: "locked", data: result }
});
```

**Quick Fix**: Используй `new Command({ update: {...} })` для state updates в tools.

**Детали**: [concepts/tools.md](../concepts/tools.md)

---

### <a id="messages-field-required"></a>#5: Missing messages Field

**Правило**: [glossary.md#messages-field-required](../glossary.md#messages-field-required)

```typescript
// ❌ НЕПРАВИЛЬНО - agent не работает
const MyState = z.object({
  phase: z.string(),
  data: z.any()
  // НЕТ messages!
});

// ✅ ПРАВИЛЬНО
import { MessagesZodState } from "@langchain/langgraph";

const MyState = z.object({
  messages: MessagesZodState.shape.messages, // ОБЯЗАТЕЛЬНО!
  phase: z.string(),
  data: z.any()
});
```

**Quick Fix**: Добавь `messages: MessagesZodState.shape.messages` в state schema.

**Детали**: [concepts/state-management.md](../concepts/state-management.md)

---

## 🟡 Common Mistakes

### #6: PostgresSaver Cleanup Забыли

```typescript
// ❌ НЕПРАВИЛЬНО - БД растет бесконтрольно
await checkpointer.setup();
// НЕТ cleanup!

// ✅ ПРАВИЛЬНО
await checkpointer.setup();

// pg_cron для автоматической очистки
await pool.query(`
  SELECT cron.schedule('cleanup-checkpoints', '0 3 * * *',
    $$DELETE FROM checkpoints
      WHERE created_at < NOW() - INTERVAL '7 days'$$
  );
`);
```

**Quick Fix**: Добавь cleanup через pg_cron (см. [concepts/checkpointers.md](../concepts/checkpointers.md)).

---

### #7: Wrong Import Paths

```typescript
// ❌ НЕПРАВИЛЬНО - старые пути
import { createAgent } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";

// ✅ ПРАВИЛЬНО - LangChain v1.0
import { createAgent, tool } from "langchain";
import { Command } from "@langchain/langgraph"; // Command остается тут
```

**Quick Fix**: `createAgent` и `tool` теперь в `"langchain"`, а `Command` в `"@langchain/langgraph"`.

---

### #8: systemPrompt vs prompt

```typescript
// ❌ НЕПРАВИЛЬНО - старое название
createAgent({
  prompt: "You are a helpful assistant"
});

// ✅ ПРАВИЛЬНО - новое название
createAgent({
  systemPrompt: "You are a helpful assistant"
});
```

**Quick Fix**: Переименуй `prompt` → `systemPrompt`.

---

### #9: Orchestrator Tool вместо Atomic Tools

```typescript
// ❌ НЕПРАВИЛЬНО - agent не видит шаги
const extractCareerData = tool(async ({ text }) => {
  const partial = await extract(text);
  if (!isValid(partial)) {
    return askQuestions(); // Agent НЕ ВИДИТ!
  }
  return confirm(partial); // Agent НЕ ВИДИТ!
});

// ✅ ПРАВИЛЬНО - atomic tools + ToolMessage направляет LLM
const extractUserContext = tool(
  async ({ text }, runtime: ToolRuntime<MyState>) => {
    const validation = await validateData(text);
    return new Command({
      update: {
        phase: validation.success ? "awaiting_confirmation" : "awaiting_clarification",
        messages: [new ToolMessage({
          content: validation.success
            ? "Data extracted. Now call confirm_data."
            : "Validation failed. Now call ask_clarification.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  { name: "extract_user_context", description: "Extract data. After this, call confirm_data or ask_clarification." }
);

const askClarification = tool(...); // Отдельный tool
const confirmCareerData = tool(...); // Отдельный tool
```

**Quick Fix**: ONE tool = ONE operation + ToolMessage направляет LLM на следующий tool.

**Детали**: [concepts/atomic-tools.md](../concepts/atomic-tools.md)

---

### #10: Полагаться только на System Prompt для Routing

```typescript
// ❌ НЕПРАВИЛЬНО - LLM может проигнорировать system prompt
systemPrompt: `If validationSuccess=false, call ask_clarification`;

const myTool = tool(async () => {
  return new Command({
    update: { validationSuccess: false }
    // Надеемся что LLM прочитает system prompt
  });
});

// ✅ ПРАВИЛЬНО - ToolMessage + description явно направляют LLM
const myTool = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    const validation = await validateData(text);
    return new Command({
      update: {
        partial: validation.partial,
        messages: [new ToolMessage({
          content: validation.success
            ? "Validation OK. MUST call confirm_data NOW."
            : "Validation FAILED. MUST call ask_clarification NOW.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  {
    name: "my_tool",
    description: "Validate data. After this, call confirm_data or ask_clarification based on result."
  }
);
```

**Quick Fix**: Используй ToolMessage + tool description для направления LLM, не только system prompt.

**Детали**: [concepts/routing.md](../concepts/routing.md)

---

### #11: Consistent Interrupt Order

```typescript
// ❌ НЕПРАВИЛЬНО - порядок меняется
async function nodeA(state: State) {
  const name = interrupt("What's your name?");
  if (state.needsAge) {
    const age = interrupt("What's your age?"); // Порядок меняется!
  }
  const city = interrupt("What's your city?");
}

// ✅ ПРАВИЛЬНО - порядок всегда одинаковый
async function nodeA(state: State) {
  const name = interrupt("What's your name?");
  const age = interrupt("What's your age?");
  const city = interrupt("What's your city?");
}
```

**Quick Fix**: Interrupts должны вызываться в одинаковом порядке каждый раз.

**Детали**: [concepts/human-in-loop.md](../concepts/human-in-loop.md#gotchas)

---

### #12: Try-Catch Around Interrupt

```typescript
// ❌ НЕПРАВИЛЬНО - interrupt не доходит до runtime
async function nodeA(state: State) {
  try {
    const name = interrupt("What's your name?");
  } catch (err) {
    console.error(err); // Ловит interrupt exception!
  }
}

// ✅ ПРАВИЛЬНО - re-throw interrupt
async function nodeA(state: State) {
  try {
    const name = interrupt("What's your name?");
  } catch (err) {
    if (err.name === "Interrupt") {
      throw err; // Re-throw!
    }
    console.error(err);
  }
}
```

**Quick Fix**: Не используй bare try-catch вокруг `interrupt()`.

**Детали**: [concepts/human-in-loop.md](../concepts/human-in-loop.md#gotchas)

---

### #13: Command без ToolMessage → undefined error

```typescript
import { ToolMessage } from "@langchain/core/messages";
import type { ToolRuntime } from "@langchain/core/tools";
import type { MyState } from "./types.js";

// ❌ НЕПРАВИЛЬНО - agent делает лишний LLM call и падает
const myTool = tool(async (_, config) => {
  return new Command({
    update: { phase: "completed", data: result }
  });
});

// ✅ ПРАВИЛЬНО - используем ToolRuntime<State> и ToolMessage class
const myTool = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    const { state, toolCallId } = runtime;

    return new Command({
      update: {
        phase: "completed",
        data: result,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- LangChain API
        messages: [new ToolMessage({ content: "Operation completed", tool_call_id: toolCallId })],
      }
    });
  },
  { name: "my_tool", description: "...", schema: z.object({}) }
);
```

**Проблема**: Без ToolMessage agent не знает что tool завершился и делает ещё один LLM вызов. Gemini может вернуть undefined response → `Cannot read properties of undefined (reading 'message')`.

**Quick Fix**:
1. Используй `ToolRuntime<State>` вместо `config` — даёт типизированный `state` и `toolCallId`
2. Используй `new ToolMessage({ content, tool_call_id: toolCallId })` — самодокументирующийся тип
3. Добавь `eslint-disable` для snake_case `tool_call_id` (LangChain API требует snake_case)

**Source**: LangChain v1 docs: https://docs.langchain.com/oss/javascript/langchain/short-term-memory

---

### #14: OpenAI Structured Output требует .nullable()

```typescript
// ❌ НЕПРАВИЛЬНО - OpenAI возвращает null для optional полей
const schema = z.object({
  name: z.string(),
  age: z.number().optional()  // OpenAI может вернуть null!
});

// ✅ ПРАВИЛЬНО - используй .nullable().optional()
const schema = z.object({
  name: z.string(),
  age: z.number().nullable().optional()
});
```

**Проблема**: OpenAI Structured Output API возвращает `null` для отсутствующих полей, а не `undefined`. Zod `.optional()` принимает только `undefined`.

**Quick Fix**: Для всех optional полей используй `.nullable().optional()`.

**Source**: OpenAI Structured Outputs spec + проверено в cold-start agent.

---

### #15: goto НЕ работает с createAgent

```typescript
// ❌ НЕ РАБОТАЕТ - goto игнорируется в createAgent!
return new Command({
  update: { phase: "next" },
  goto: "confirm_data"  // ИГНОРИРУЕТСЯ
});

// ✅ ПРАВИЛЬНО - LLM routing через tool descriptions
const processTool = tool(
  async () => { ... },
  {
    name: "process_data",
    description: "Process data. After this, MUST call confirm_data."
  }
);
```

**Проблема**: `createAgent` использует упрощённый граф без explicit routing. Все `goto` в Command игнорируются.

**Quick Fix**: Направляй LLM через tool descriptions и system prompt вместо goto.

**Альтернатива**: Используй `StateGraph` API напрямую для explicit routing.

**Проверено**: `poc/goto-in-createagent.ts`, `poc/hybrid-interrupt.ts`

---

## 📋 Pre-Launch Checklist

- [ ] ✅ Gemini models с префиксом `"models/"`
- [ ] ✅ Checkpointer подключен (если используешь interrupts)
- [ ] ✅ thread_id используется для persistence
- [ ] ✅ Messages field в custom stateSchema
- [ ] ✅ Command для обновления state в tools
- [ ] ✅ ToolMessage с tool_call_id в Command.update.messages
- [ ] ✅ PostgresSaver cleanup настроен (pg_cron)
- [ ] ✅ systemPrompt вместо prompt
- [ ] ✅ Imports из правильных пакетов (`"langchain"`)
- [ ] ✅ Atomic tools вместо orchestrator (agent видит каждый шаг)
- [ ] ✅ LLM routing через tool descriptions (goto не работает с createAgent!)
- [ ] ✅ Consistent interrupt order (если используешь `interrupt()`)
- [ ] ✅ No bare try-catch around interrupts
- [ ] ✅ `.nullable().optional()` для optional полей (OpenAI compatibility)
- [ ] ✅ HITLResponse format для resume: `{ decisions: [{ type: "approve" }] }`

---

## 🔗 См. также

- [glossary.md](../glossary.md) - Критичные правила + термины
- [concepts/routing.md](../concepts/routing.md) - Hybrid routing pattern
- [concepts/human-in-loop.md](../concepts/human-in-loop.md) - Interrupt gotchas
- [concepts/atomic-tools.md](../concepts/atomic-tools.md) - Atomic tools pattern
- [Production Example](../../../../src/facade/langchain/career-collector-agent.ts) - Проверенный production agent
