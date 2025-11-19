# LangChain v1.0 Middleware

**Зачем**: Hooks жизненного цикла агента, human-in-the-loop, контроль выполнения.

---

## 🎨 Middleware Hooks

### Полный цикл выполнения
```
beforeAgent → beforeModel → [Model Call] → afterModel
   → wrapToolCall → [Tool Execution] → afterAgent
```

### Создание Middleware
```typescript
import { createMiddleware } from "langchain";

const loggingMiddleware = createMiddleware({
  name: "Logging",

  beforeAgent: async (request) => {
    console.log("Starting agent execution");
    return request;
  },

  beforeModel: async (request) => {
    console.log("Calling model with", request.messages.length, "messages");
    return request;
  },

  wrapModelCall: async (request, handler) => {
    const start = Date.now();
    const result = await handler(request);
    console.log(`Model took ${Date.now() - start}ms`);
    return result;
  },

  afterModel: async (response) => {
    console.log("Model returned", response.message);
    return response;
  },

  wrapToolCall: async (request, handler) => {
    console.log(`Calling tool: ${request.toolName}`);
    return handler(request);
  },

  afterAgent: async (response) => {
    console.log("Agent complete");
    return response;
  }
});
```

---

## 🤖 Human-in-the-Loop для WayMates

### Базовая конфигурация
```typescript
import { humanInTheLoopMiddleware } from "langchain";

const middleware = humanInTheLoopMiddleware({
  interruptOn: {
    // Boolean - простое прерывание
    validate_data: true,

    // Расширенная конфигурация
    generate_preview: {
      allowedDecisions: ["confirm", "edit", "cancel"],
      description: "Please review your information"
    },

    // Условное прерывание
    normalize_terms: {
      condition: (result) => result.unverifiedTerms?.length > 0,
      description: (result) => `Found ${result.unverifiedTerms.length} new terms`
    }
  }
});
```

### Resume после прерывания
```typescript
import { Command } from "@langchain/langgraph";

// Первый вызов - прерывается на generate_preview
const result1 = await agent.invoke(
  { messages: [{ role: "user", content: "Add my experience..." }] },
  { configurable: { thread_id: "exp-123" } }
);

// Проверяем прерывание
if (result1.next) {
  console.log("Interrupted at:", result1.next[0]);
  console.log("Question:", result1.messages[result1.messages.length - 1].content);
}

// Resume с решением пользователя
const result2 = await agent.invoke(
  new Command({
    resume: {
      decisions: [{ type: "confirm" }]
    }
  }),
  { configurable: { thread_id: "exp-123" } } // Тот же thread_id!
);
```

---

## 🎮 WayMates Validation Control Middleware

### Управление параллельной валидацией
```typescript
const validationControlMiddleware = createMiddleware({
  name: "ValidationControl",

  // После вызова tool
  afterToolCall: async (result, context) => {
    const toolName = context.toolName;
    const state = context.state;

    // Если semantic validation нашла критические ошибки
    if (toolName === "validate_semantic" && result.errors?.length > 3) {
      // Устанавливаем флаг для пропуска дорогих операций
      return new Command({
        update: {
          skipExpensiveOps: true,
          requiresHumanReview: true
        }
      });
    }

    // Сохраняем результаты валидации
    if (toolName.startsWith("validate_") || toolName === "normalize_terms") {
      const field = toolName.replace("validate_", "").replace("_terms", "");

      return new Command({
        update: {
          validationResults: {
            ...state.validationResults,
            [field]: result
          }
        }
      });
    }

    return result;
  },

  // Перед вызовом модели - анализируем результаты
  beforeModel: async (request) => {
    const state = request.state;

    if (state.phase === "validating") {
      const results = state.validationResults;

      // Если все 3 валидации завершены
      if (results?.semantic && results?.schema && results?.normalization) {
        const hasErrors = !results.semantic.valid || !results.schema.valid;

        if (hasErrors) {
          // Добавляем инструкцию модели
          request.messages.push({
            role: "system",
            content: `Validation found issues: ${JSON.stringify(results)}`
          });
        }
      }
    }

    return request;
  }
});
```

---

## 📊 Performance Middleware

```typescript
const performanceMiddleware = createMiddleware({
  name: "Performance",

  wrapToolCall: async (request, handler) => {
    const start = Date.now();
    const result = await handler(request);
    const duration = Date.now() - start;

    // Логируем медленные tools
    if (duration > 500) {
      console.warn(`Slow tool: ${request.toolName} took ${duration}ms`);
    }

    // Если tool слишком медленный, можем прервать цепочку
    if (duration > 2000) {
      return new Command({
        update: {
          error: `Tool ${request.toolName} timeout`,
          skipRemaining: true
        }
      });
    }

    return result;
  }
});
```

---

## 🔄 Command API

### Обновление State
```typescript
import { Command } from "@langchain/langgraph";

// В middleware или tool
return new Command({
  update: {
    // Любые поля из stateSchema
    phase: "locked",
    lockedVersion: data,
    validationResults: results
  }
});
```

### Resume после прерывания
```typescript
// Resume с пользовательским вводом
new Command({
  resume: "User's answer to the question"
});

// Resume с решением
new Command({
  resume: {
    decisions: [{
      type: "edit",
      edits: { company: "Google" }
    }]
  }
});
```

---

## ⚠️ Важные моменты

1. **Порядок выполнения**: beforeAgent → beforeModel → model → afterModel → tools → afterAgent
2. **Command для state**: Единственный способ обновить state из middleware
3. **thread_id обязателен**: Для resume после прерывания
4. **Checkpointer нужен**: Без него прерывания не работают
5. **Middleware композиция**: Выполняются в порядке объявления