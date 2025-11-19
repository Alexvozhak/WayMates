# LangChain v1.0 Agents & Tools

**Зачем**: Создание агентов через createAgent API, определение tools, управление state.

---

## 🚀 createAgent API

```typescript
import { createAgent } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const agent = createAgent({
  model: new ChatGoogleGenerativeAI({
    model: "models/gemini-2.0-flash", // ⚠️ КРИТИЧНО: prefix "models/"
    temperature: 0.7
  }),
  tools: [...],              // Tool[] - инструменты агента
  systemPrompt: "...",       // НЕ prompt! Системное сообщение
  middleware: [...],         // Middleware[] - хуки жизненного цикла
  stateSchema: ZodSchema,    // Расширение state (optional)
  contextSchema: ZodSchema,  // Runtime context (optional)
  checkpointer: Checkpointer // Persistence (optional)
});
```

---

## 🛠️ Tool Patterns для WayMates

### Базовый Tool
```typescript
import { tool } from "langchain";
import { z } from "zod";

const normalizeTool = tool(
  async ({ text, type }) => {
    // Твоя бизнес-логика
    if (type === "skill") {
      // LLM нормализует skill с оценкой complexity
      return { canonical: "Python", complexity: 60 };
    }
    return { canonical: text };
  },
  {
    name: "normalize",
    description: "Normalize terms using dictionaries",
    schema: z.object({
      text: z.string().describe("Raw user input"),
      type: z.enum(["skill", "position", "domain"])
    })
  }
);
```

### Tool с доступом к State
```typescript
const versionLockTool = tool(
  async (_, config) => {
    const state = config.state; // Доступ к текущему state

    if (state.phase === "collecting") {
      // Возвращаем Command для обновления state
      return new Command({
        update: {
          phase: "locked",
          lockedVersion: state.workingData
        }
      });
    }
    return "Already locked";
  },
  { name: "lock_version" }
);
```

### Parallel Tools (WayMates validation)
```typescript
// Agent САМ вызовет эти tools параллельно!
const validationTools = [
  tool(validateSemantic, { name: "validate_semantic" }),
  tool(validateSchema, { name: "validate_schema" }),
  tool(normalizeTerms, { name: "normalize_terms" })
];

// В system prompt направляем поведение:
systemPrompt: `When validating data, ALWAYS call all three validation tools SIMULTANEOUSLY for 3x speedup.`
```

---

## 📦 State Management

### Custom State Schema
```typescript
import { MessagesZodState } from "@langchain/langgraph";

const AddExperienceState = z.object({
  // Обязательное поле messages
  messages: MessagesZodState.shape.messages,

  // WayMates-specific fields
  phase: z.enum(["collecting", "locked", "refining"]),
  workingData: z.any().optional(),
  lockedVersion: z.any().optional(), // Immutable после lock
  finalData: z.any().optional()
});

const agent = createAgent({
  stateSchema: AddExperienceState,
  // ...
});
```

### Обновление State через Command
```typescript
import { Command } from "@langchain/langgraph";

// В tool:
return new Command({
  update: {
    phase: "locked",
    lockedVersion: data,
    skipExpensiveOps: true // Флаг для других tools
  }
});
```

---

## 🎯 WayMates Agent Examples

### search_careers Agent
```typescript
export async function createSearchCareersAgent() {
  return createAgent({
    model: "models/gemini-2.0-flash",
    tools: [
      normalizeTool,    // LLM нормализует raw input
      searchCoreTool    // Вызывает Core API
    ],
    systemPrompt: `You help users find career paths.
      1. Normalize position and skills using normalize tool
      2. Search careers with normalized data
      3. Format results in user-friendly way`
  });
}
```

### add_experience Agent (complex)
```typescript
export async function createAddExperienceAgent() {
  return createAgent({
    model: "models/gemini-2.0-flash",
    tools: [
      extractDataTool,
      // Validation - agent вызовет параллельно!
      validateSemanticTool,
      validateSchemaTool,
      normalizeTermsTool,
      // Version management
      generatePreviewTool,
      applyEditsTool,
      // Persistence
      persistTool
    ],
    stateSchema: AddExperienceState,
    middleware: [
      humanInTheLoopMiddleware({
        interruptOn: { generate_preview: true }
      })
    ],
    checkpointer: postgresSaver,
    systemPrompt: `Help user add work experience.
      IMPORTANT: Validate ALL aspects IN PARALLEL for 3x speedup.`
  });
}
```

---

## ⚠️ Важные моменты

1. **Model names**: ВСЕГДА `"models/gemini-..."`, НЕ `"gemini-..."`
2. **Parallel tools**: Agent сам решает порядок вызова через system prompt
3. **State persistence**: Нужен checkpointer для сохранения между вызовами
4. **Command API**: Единственный способ обновить state из tool
5. **Messages field**: ОБЯЗАТЕЛЬНО в custom stateSchema