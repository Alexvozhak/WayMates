# LangChain v1.0 - Критические ошибки

**⚠️ ОБЯЗАТЕЛЬНО К ПРОЧТЕНИЮ**: Эти ошибки сломают твой код!

---

## 🔴 КРИТИЧНО: Gemini Model Names

### ❌ НЕПРАВИЛЬНО (не будет работать!)
```typescript
model: "gemini-2.0-flash"
model: "gemini-1.5-flash"
model: "gemini-pro"
```

### ✅ ПРАВИЛЬНО
```typescript
model: "models/gemini-2.0-flash"
model: "models/gemini-1.5-flash"
model: "models/gemini-1.0-pro"
```

**Почему**: Gemini API требует prefix `"models/"` для всех моделей.

**Полный пример**:
```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  model: "models/gemini-2.0-flash", // ✅ С префиксом!
  temperature: 0.7,
  apiKey: process.env.GOOGLE_API_KEY
});
```

---

## 🔴 Missing Checkpointer для прерываний

### ❌ НЕПРАВИЛЬНО
```typescript
const agent = createAgent({
  model,
  tools,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { confirm: true }
    })
  ]
  // НЕТ checkpointer - прерывания не работают!
});
```

### ✅ ПРАВИЛЬНО
```typescript
const agent = createAgent({
  model,
  tools,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { confirm: true }
    })
  ],
  checkpointer: postgresSaver // ОБЯЗАТЕЛЬНО для прерываний!
});
```

---

## 🟡 State не сохраняется между вызовами

### ❌ НЕПРАВИЛЬНО
```typescript
// Первый вызов
await agent.invoke(
  { messages: [...] }
  // НЕТ thread_id - новый state каждый раз!
);

// Второй вызов - state потерян
await agent.invoke(
  { messages: [...] }
);
```

### ✅ ПРАВИЛЬНО
```typescript
const config = {
  configurable: {
    thread_id: "session-123" // Один thread_id для всей сессии
  }
};

// Первый вызов
await agent.invoke({ messages: [...] }, config);

// Второй вызов - state восстановлен
await agent.invoke({ messages: [...] }, config);
```

---

## 🟡 Parallel tools не работают

### ❌ НЕПРАВИЛЬНО
```typescript
// Sequential execution (медленно)
const result1 = await validateSemanticTool.invoke(...);
const result2 = await validateSchemaTool.invoke(...);
const result3 = await normalizeTermsTool.invoke(...);
```

### ✅ ПРАВИЛЬНО
```typescript
// Agent сам вызывает параллельно через system prompt
systemPrompt: `When validating:
  1. ALWAYS call validate_semantic, validate_schema, and normalize_terms SIMULTANEOUSLY
  2. This gives 3x speedup
`
```

---

## 🟡 Command не обновляет state

### ❌ НЕПРАВИЛЬНО
```typescript
// В tool
return {
  phase: "locked",
  lockedVersion: data
}; // Это НЕ обновит state!
```

### ✅ ПРАВИЛЬНО
```typescript
import { Command } from "@langchain/langgraph";

// В tool
return new Command({
  update: {
    phase: "locked",
    lockedVersion: data
  }
});
```

---

## 🟡 Messages field забыли в stateSchema

### ❌ НЕПРАВИЛЬНО
```typescript
const MyState = z.object({
  phase: z.string(),
  data: z.any()
  // НЕТ messages - агент не будет работать!
});
```

### ✅ ПРАВИЛЬНО
```typescript
import { MessagesZodState } from "@langchain/langgraph";

const MyState = z.object({
  messages: MessagesZodState.shape.messages, // ОБЯЗАТЕЛЬНО!
  phase: z.string(),
  data: z.any()
});
```

---

## 🟠 PostgresSaver cleanup забыли

### ❌ НЕПРАВИЛЬНО
```typescript
// Только setup, без cleanup
await checkpointer.setup();
// БД будет расти бесконтрольно!
```

### ✅ ПРАВИЛЬНО
```typescript
// Setup + cleanup strategy
await checkpointer.setup();

// pg_cron для автоматической очистки
await pool.query(`
  SELECT cron.schedule('cleanup-checkpoints', '0 3 * * *',
    $$DELETE FROM checkpoints
      WHERE created_at < NOW() - INTERVAL '7 days'$$
  );
`);
```

---

## 🟠 Wrong import paths

### ❌ НЕПРАВИЛЬНО
```typescript
import { createAgent } from "@langchain/langgraph"; // Старый путь!
import { tool } from "@langchain/core/tools"; // Неправильно!
```

### ✅ ПРАВИЛЬНО
```typescript
import { createAgent, tool } from "langchain"; // Из основного пакета!
import { Command } from "@langchain/langgraph"; // Command остается тут
```

---

## 🟠 systemPrompt vs prompt

### ❌ НЕПРАВИЛЬНО
```typescript
createAgent({
  prompt: "You are a helpful assistant" // Старое название!
});
```

### ✅ ПРАВИЛЬНО
```typescript
createAgent({
  systemPrompt: "You are a helpful assistant" // Новое название!
});
```

---

## 🔵 TypeScript типы

### ❌ НЕПРАВИЛЬНО
```typescript
const agent = createAgent({...}); // Type is complex generic
const result = await agent.invoke(...); // Type unknown
```

### ✅ ПРАВИЛЬНО
```typescript
// Явные типы для лучшего DX
type MyAgent = ReturnType<typeof createAgent>;
type MyState = z.infer<typeof MyStateSchema>;

const agent: MyAgent = createAgent({...});
const result = await agent.invoke(...) as {
  messages: Message[];
  next?: string[];
};
```

---

## 📋 Checklist перед запуском

- [ ] Gemini models с префиксом `"models/"`
- [ ] Checkpointer подключен для прерываний
- [ ] thread_id используется для persistence
- [ ] Messages field в custom stateSchema
- [ ] Command для обновления state
- [ ] PostgresSaver cleanup настроен
- [ ] systemPrompt вместо prompt
- [ ] Imports из правильных пакетов