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

// ✅ ПРАВИЛЬНО - atomic tools
const extractUserContext = tool(async ({ text }) => {
  const validation = await validateData(text);
  return new Command({
    goto: validation.success ? "confirm_career_data" : "ask_clarification"
  });
});

const askClarification = tool(...); // Отдельный tool
const confirmCareerData = tool(...); // Отдельный tool
```

**Quick Fix**: ONE tool = ONE operation. Agent должен видеть каждый шаг.

**Детали**: [concepts/atomic-tools.md](../concepts/atomic-tools.md)

---

### #10: Implicit Routing для Business Logic

```typescript
// ❌ НЕПРАВИЛЬНО - LLM решает через prompt
systemPrompt: `If validationSuccess=false, call ask_clarification`;

const myTool = tool(async () => {
  return new Command({
    update: { validationSuccess: false }
    // NO goto - agent сам выбирает!
  });
});

// ✅ ПРАВИЛЬНО - explicit goto
const myTool = tool(async () => {
  const validation = await validateData(text);
  return new Command({
    update: { partial: validation.partial },
    goto: validation.success ? "confirm_career_data" : "ask_clarification"
  });
});
```

**Quick Fix**: Business logic → explicit `goto`. User intent → implicit (LLM).

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

## 📋 Pre-Launch Checklist

- [ ] ✅ Gemini models с префиксом `"models/"`
- [ ] ✅ Checkpointer подключен (если используешь interrupts)
- [ ] ✅ thread_id используется для persistence
- [ ] ✅ Messages field в custom stateSchema
- [ ] ✅ Command для обновления state в tools
- [ ] ✅ PostgresSaver cleanup настроен (pg_cron)
- [ ] ✅ systemPrompt вместо prompt
- [ ] ✅ Imports из правильных пакетов (`"langchain"`)
- [ ] ✅ Atomic tools вместо orchestrator (agent видит каждый шаг)
- [ ] ✅ Explicit routing через goto для business logic
- [ ] ✅ Consistent interrupt order (если используешь `interrupt()`)
- [ ] ✅ No bare try-catch around interrupts

---

## 🔗 См. также

- [glossary.md](../glossary.md) - Критичные правила + термины
- [concepts/routing.md](../concepts/routing.md) - Hybrid routing pattern
- [concepts/human-in-loop.md](../concepts/human-in-loop.md) - Interrupt gotchas
- [concepts/atomic-tools.md](../concepts/atomic-tools.md) - Atomic tools pattern
- [Production Example](../../../../src/facade/langchain/career-collector-agent.ts) - Проверенный production agent
