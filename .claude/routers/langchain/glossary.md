# LangChain v1.0 - Glossary

**Назначение**: Канонический источник для критичных правил и терминов. Все другие файлы ссылаются сюда.

---

## 🔴 Критичные правила

### <a id="gemini-prefix"></a>Gemini Model Names

**ОБЯЗАТЕЛЬНО**: Gemini API требует prefix `"models/"` для всех моделей.

```typescript
// ❌ НЕПРАВИЛЬНО - не работает
model: "gemini-2.0-flash"

// ✅ ПРАВИЛЬНО
model: "models/gemini-2.0-flash"
```

**Применяется**: Везде, где указывается имя Gemini модели (createAgent, ChatGoogleGenerativeAI).

---

### <a id="checkpointer-required"></a>Checkpointer Required

**ОБЯЗАТЕЛЬНО**: Checkpointer нужен для:
- Прерываний через `humanInTheLoopMiddleware` или `interrupt()`
- Сохранения state между вызовами
- Resume после interrupts

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

**См**: [concepts/checkpointers.md](#), [concepts/human-in-loop.md](#)

---

### <a id="thread-id-persistence"></a>Thread ID for Persistence

**ОБЯЗАТЕЛЬНО**: `thread_id` в `configurable` для сохранения state.

```typescript
// ❌ НЕПРАВИЛЬНО - state теряется каждый раз
await agent.invoke({ messages: [...] });

// ✅ ПРАВИЛЬНО - state сохраняется
const config = {
  configurable: {
    thread_id: "session-123" // Один ID для всей сессии
  }
};
await agent.invoke({ messages: [...] }, config);
```

**Применяется**: Все вызовы `agent.invoke()`, `agent.stream()`, `agent.getState()`.

**См**: [concepts/checkpointers.md](#)

---

### <a id="command-for-updates"></a>Command for State Updates

**ОБЯЗАТЕЛЬНО**: Используй `Command` из `@langchain/langgraph` для обновления state в tools.

```typescript
// ❌ НЕПРАВИЛЬНО - state не обновится
return { phase: "locked", data: result };

// ✅ ПРАВИЛЬНО
import { Command } from "@langchain/langgraph";
return new Command({
  update: { phase: "locked", data: result }
});
```

**Применяется**: Возврат из tool functions, node functions.

**См**: [concepts/tools.md](#), [concepts/routing.md](#)

---

### <a id="messages-field-required"></a>Messages Field Required

**ОБЯЗАТЕЛЬНО**: Custom state schema ДОЛЖЕН содержать `messages` field.

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

**Применяется**: Custom `stateSchema` в `createAgent()`.

**См**: [concepts/state-management.md](#)

---

## 📚 Основные термины

### createAgent

**Что**: Упрощенный API для создания агентов в LangChain v1.0.

**Синтаксис**:
```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [tool1, tool2],
  systemPrompt: "You are a helpful assistant",
  middleware: [humanInTheLoopMiddleware(...)],
  checkpointer: postgresService.getCheckpointer(),
  stateSchema: MyStateSchema
});
```

**Ключевые параметры**:
- `model`: string (название модели) или ChatModel instance
- `tools`: массив tool объектов
- `systemPrompt`: string или function
- `middleware`: массив middleware (humanInTheLoopMiddleware, custom)
- `checkpointer`: PostgresSaver для persistence
- `stateSchema`: Zod schema для custom state

**См**: [concepts/agents.md](#)

---

### tool()

**Что**: Factory function для создания инструментов с Zod-валидацией.

**Синтаксис**:
```typescript
import { tool } from "langchain";
import { z } from "zod";

const myTool = tool(
  async (params, config) => {
    // Логика tool
    return result;
  },
  {
    name: "tool_name",
    description: "What this tool does",
    schema: z.object({
      param1: z.string().describe("Parameter description")
    })
  }
);
```

**Ключевые моменты**:
- Первый аргумент: async функция-обработчик
- Второй аргумент: конфигурация (name, description, schema)
- `schema`: Zod объект для валидации параметров
- `config`: доступ к tool runtime (state, context)

**См**: [concepts/tools.md](#)

---

### Command

**Что**: Объект для обновления state и управления routing в LangGraph.

**Синтаксис**:
```typescript
import { Command, END } from "@langchain/langgraph";

// Обновление state
return new Command({
  update: { foo: "bar" }
});

// Обновление + routing
return new Command({
  update: { foo: "bar" },
  goto: "nodeB"
});

// Resume из interrupt
return new Command({
  resume: userInput
});

// Завершение workflow
return new Command({
  goto: END
});
```

**Применяется**: Возврат из tools, nodes, interrupt resumption.

**См**: [concepts/routing.md](#), [concepts/tools.md](#)

---

### interrupt()

**Что**: Функция для паузы execution и запроса user input (human-in-the-loop).

**Синтаксис**:
```typescript
import { interrupt } from "@langchain/langgraph";

async function myNode(state) {
  const userInput = interrupt("Вопрос пользователю?");
  // После resume userInput = значение из Command({ resume })
  return { result: userInput };
}
```

**Требования**:
- Checkpointer ОБЯЗАТЕЛЕН ([см. правило](#checkpointer-required))
- thread_id для resume
- JSON-serializable payload

**См**: [concepts/human-in-loop.md](#)

---

### humanInTheLoopMiddleware

**Что**: Native middleware для автоматических interrupts на определенных tools.

**Синтаксис**:
```typescript
import { humanInTheLoopMiddleware } from "langchain";

const agent = createAgent({
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,
        confirm_data: true
      }
    })
  ],
  checkpointer // ОБЯЗАТЕЛЬНО!
});
```

**Принцип работы**:
1. Tool вызывается
2. Middleware прерывает execution ДО выполнения tool
3. Результат доступен через `result.__interrupt__`
4. Resume через `agent.invoke(new Command({ resume: value }), config)`

**См**: [concepts/human-in-loop.md](#), [concepts/middleware.md](#)

---

### PostgresSaver

**Что**: Checkpointer для сохранения state в PostgreSQL.

**Синтаксис**:
```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Из connection string
const checkpointer = PostgresSaver.fromConnString(
  "postgresql://user:password@localhost:5432/db"
);

// Из pg Pool
const checkpointer = new PostgresSaver(pool);

// ВАЖНО: Создать таблицы при первом запуске
await checkpointer.setup();
```

**Cleanup ОБЯЗАТЕЛЕН**: ~100 rows per workflow → автоматическая очистка через pg_cron.

**См**: [concepts/checkpointers.md](#)

---

### MessagesZodState

**Что**: Готовая Zod schema для messages field в state.

**Синтаксис**:
```typescript
import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

const MyState = z.object({
  messages: MessagesZodState.shape.messages,
  customField: z.string()
});
```

**Альтернатива** (manual):
```typescript
import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";

const MyState = z.object({
  messages: z.array(z.custom<BaseMessage>()).register(registry, MessagesZodMeta)
});
```

**См**: [concepts/state-management.md](#)

---

### withStructuredOutput

**Что**: Метод для получения Zod-валидированного structured output от LLM.

**Синтаксис**:
```typescript
import { z } from "zod";

const MySchema = z.object({
  title: z.string(),
  year: z.number()
});

const structuredLlm = model.withStructuredOutput(MySchema);
const result = await structuredLlm.invoke("Tell me about Inception");
// result: { title: "Inception", year: 2010 }
```

**Применяется**: Extracting structured data, parsing user input.

**См**: [concepts/structured-output.md](#)

---

## 🎯 Паттерны

### Atomic Tools Pattern

**Принцип**: ONE tool = ONE entity operation. Agent видит каждый шаг.

```typescript
// ❌ НЕПРАВИЛЬНО - orchestrator tool
const extractCareerData = tool(async ({ text }) => {
  const partial = await extract(text);
  if (!isValid(partial)) {
    return askQuestions(); // Agent не видит этот шаг!
  }
  return confirm(partial); // Agent не видит этот шаг!
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

**Преимущества**:
- Agent видит каждый шаг workflow
- Легко unit-test каждый tool
- Переиспользование (70-85% в production)

**См**: [patterns/atomic-tools.md](#), [career-collector-agent.ts:398](../../../src/facade/langchain/career-collector-agent.ts#L398)

---

### Hybrid Routing

**Принцип**: Deterministic goto для business logic + LLM для user intent.

```typescript
// Business logic → goto (детерминированно)
const extractUserContext = tool(async ({ text }, { state }) => {
  const validation = userContextSchema.safeParse(merged);

  if (!validation.success) {
    return new Command({
      goto: "ask_clarification" // Deterministic!
    });
  }

  return new Command({
    goto: "confirm_career_data" // Deterministic!
  });
});

// User intent → LLM (через system prompt)
systemPrompt: `
AFTER CONFIRMATION (status="awaiting_confirmation"):
1. CONFIRM intent: "yes", "да", "ok" → Call save_career_data
2. CORRECTION intent: "change X to Y" → Call extract_user_context
3. CANCEL intent: "cancel", "stop" → Cancel workflow
`
```

**Когда использовать**:
- ✅ goto: Business logic, валидация, error handling
- ✅ LLM: User intent parsing, natural language понимание

**См**: [concepts/routing.md](#), [career-collector-agent.ts:311](../../../src/facade/langchain/career-collector-agent.ts#L311)

---

### Multi-Round Clarification

**Принцип**: Iterative data collection с max rounds protection.

```typescript
const extractUserContext = tool(async ({ text }, { state }) => {
  const { clarificationRound = 0 } = state;

  // Merge new data
  const merged = mergePartialWithAnswers(state.partialContext, newPartial);

  // Validate
  const validation = userContextSchema.safeParse(merged);

  if (!validation.success) {
    const round = clarificationRound + 1;
    const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

    if (round > maxRounds) {
      return new Command({
        update: { status: "failed" },
        goto: END
      });
    }

    return new Command({
      update: { clarificationRound: round },
      goto: "ask_clarification"
    });
  }

  // Success
  return new Command({
    update: { clarificationRound: 0 },
    goto: "confirm_career_data"
  });
});
```

**Защита**: Max rounds предотвращает бесконечные циклы.

**См**: [concepts/human-in-loop.md](#), [career-collector-agent.ts:182](../../../src/facade/langchain/career-collector-agent.ts#L182)

---

## 🔗 Cross-references

- [Concepts](./concepts/) - Короткие заметки по концепциям
- [Patterns](./patterns/) - Проверенные паттерны с примерами
- [Reference](./reference/) - Gotchas и troubleshooting
- [Production Example](../../../src/facade/langchain/career-collector-agent.ts) - Полный production agent
