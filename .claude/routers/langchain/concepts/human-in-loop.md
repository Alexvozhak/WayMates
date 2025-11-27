# Human-in-the-Loop в LangChain v1.0

**Назначение**: Как остановить execution для получения user input (interrupts, confirmations, clarifications).

**Когда читать**: При проектировании workflows с user confirmations или multi-round dialogs.

---

## Два способа interrupts

### 1. humanInTheLoopMiddleware (Recommended для createAgent)

**Принцип**: Native middleware прерывает execution **ДО** выполнения tool.

**Setup**:
```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { postgresService } from "./infrastructure/postgres.service.js";

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [askClarification, confirmCareerData, saveCareerData],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,    // Interrupt на этом tool
        confirm_career_data: true   // Interrupt на этом tool
      }
    })
  ],
  checkpointer: postgresService.getCheckpointer(), // ОБЯЗАТЕЛЬНО!
  systemPrompt: "..."
});
```

**Как работает**:
1. Tool вызывается (например, `ask_clarification`)
2. Middleware **прерывает** execution ДО выполнения tool
3. Agent returns с `__interrupt__` field
4. User отвечает
5. Resume через `Command({ resume })`

**См**: [Interrupt Workflow](#interrupt-workflow)

---

### 2. interrupt() Function (Functional API)

**Принцип**: Явный вызов `interrupt()` внутри node/tool.

**Setup**:
```typescript
import { interrupt } from "@langchain/langgraph";
import { entrypoint } from "@langchain/langgraph";

const reviewNode = entrypoint(async (state) => {
  // Пауза для human review
  const approved = interrupt("Do you approve this action?");
  // После resume: approved = значение из Command({ resume })
  return { approved };
});
```

**Когда использовать**:
- ✅ Functional API (task, entrypoint)
- ❌ createAgent API - используй middleware

---

## Interrupt Workflow

### Step 1: Setup (Checkpointer + Thread ID)

```typescript
// Создаем checkpointer
const checkpointer = postgresService.getCheckpointer();

// Создаем agent с middleware
const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [askClarification, confirmCareerData],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,
        confirm_career_data: true
      }
    })
  ],
  checkpointer // ОБЯЗАТЕЛЬНО!
});
```

**Правило**: Без checkpointer interrupts НЕ РАБОТАЮТ ([см. glossary](../glossary.md#checkpointer-required)).

---

### Step 2: Trigger Interrupt

```typescript
const config = {
  configurable: {
    thread_id: "session-123" // Один ID для всей сессии
  }
};

// Первый вызов - триггерит interrupt
const result = await agent.invoke(
  {
    messages: [{ role: "user", content: "I worked as Senior Engineer" }]
  },
  config
);
```

**Внутри**:
1. Agent вызывает `extract_user_context`
2. Tool routes через `goto: "ask_clarification"`
3. Middleware видит `ask_clarification` в `interruptOn`
4. Middleware **прерывает** execution ДО выполнения tool
5. State сохраняется в checkpointer (thread_id)

---

### Step 3: Check Interrupt

```typescript
// Проверяем, был ли interrupt
if (result.__interrupt__) {
  const interrupts = result.__interrupt__;
  console.log(interrupts);
  // [{ value: { status: "awaiting_clarification", message: "Questions..." } }]

  // Показываем user вопросы
  const message = interrupts[0].value.message;
  console.log(message);
}
```

**Структура `__interrupt__`**:
```typescript
type Interrupt = {
  __interrupt__: Array<{
    value: any;      // Payload из interrupt() или state
    when: "during";  // Когда прервано
  }>;
};
```

---

### Step 4: Resume with User Input

```typescript
import { Command } from "@langchain/langgraph";

// User отвечает на вопросы
const userAnswers = "Python, React, 3 years";

// Resume с user input
const resumeResult = await agent.invoke(
  new Command({
    resume: {
      role: "user",
      content: userAnswers
    }
  }),
  config // ТОТ ЖЕ thread_id!
);
```

**Внутри**:
1. Checkpointer восстанавливает state из thread_id
2. Agent продолжает с места прерывания
3. LLM интерпретирует user intent через system prompt
4. Agent вызывает следующий tool (например, `extract_user_context`)

---

## Multi-Round Pattern

**Принцип**: Iterative data collection с накоплением state + max rounds protection.

**Production Example**: [career-collector-agent.ts:182-209](../../../../src/facade/langchain/career-collector-agent.ts#L182)

### State Schema

```typescript
import { z } from "zod";
import { MessagesZodState } from "@langchain/langgraph";

const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  partialContext: userContextSchemaPartial.optional(), // Накопленные данные
  contexts: z.array(userContextSchema).optional(),     // Валидированные данные
  status: z.enum([
    "collecting",
    "awaiting_clarification",  // После interrupt
    "awaiting_confirmation",   // После interrupt
    "complete",
    "failed"
  ]).optional(),
  message: z.string().optional(),              // Message для user
  clarificationRound: z.number().default(0)    // Counter для max rounds
});
```

---

### Round 1: Initial Parse

```typescript
// User: "I worked as Senior Engineer at Google"

const extractUserContext = tool(
  async ({ text }, toolConfig: { state: AgentState }) => {
    const { clarificationRound = 0 } = toolConfig.state;

    // Parse user input
    const newPartial = await extractSingleContextTool.invoke({ text });

    // Validate
    const validation = userContextSchema.safeParse(newPartial);

    if (!validation.success) {
      const round = clarificationRound + 1;
      const questions = buildClarificationQuestions(validation.error);

      // Increment round counter + goto interrupt
      return new Command({
        update: {
          partialContext: newPartial,          // Сохраняем parsed data
          clarificationRound: round,           // Increment counter
          status: "awaiting_clarification",
          message: formatQuestions(questions)  // Questions для user
        },
        goto: "ask_clarification"              // Trigger interrupt
      });
    }

    // Success path...
  }
);
```

**Результат**:
```typescript
{
  __interrupt__: [{
    value: {
      status: "awaiting_clarification",
      message: "What technologies/skills did you use?\nWhich city were you working in?"
    }
  }],
  partialContext: { position: "Senior Engineer", company: "Google" },
  clarificationRound: 1
}
```

---

### Round 2: Merge Answers

```typescript
// User: "Python, React, San Francisco"

const extractUserContext = tool(
  async ({ text }, toolConfig: { state: AgentState }) => {
    const { partialContext, clarificationRound = 0 } = toolConfig.state;

    // Parse new answers
    const newPartial = await extractSingleContextTool.invoke({ text });

    // Merge with existing data
    const merged = mergePartialWithAnswers(partialContext, newPartial);
    // merged = {
    //   position: "Senior Engineer",
    //   company: "Google",
    //   skills: ["Python", "React"],
    //   cityName: "San Francisco"
    // }

    // Validate merged data
    const validation = userContextSchema.safeParse(merged);

    if (!validation.success) {
      const round = clarificationRound + 1;
      const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

      // Max rounds protection
      if (round > maxRounds) {
        return new Command({
          update: {
            status: "failed",
            message: "Could not collect valid data after multiple attempts."
          },
          goto: END
        });
      }

      // Another round of clarification
      const questions = buildClarificationQuestions(validation.error);
      return new Command({
        update: {
          partialContext: merged,              // Updated partial data
          clarificationRound: round,           // Increment counter
          status: "awaiting_clarification",
          message: formatQuestions(questions)
        },
        goto: "ask_clarification"
      });
    }

    // Success - all data collected
    return new Command({
      update: {
        contexts: [validation.data],
        clarificationRound: 0,                 // Reset counter
        status: "awaiting_confirmation"
      },
      goto: "confirm_career_data"
    });
  }
);
```

**Ключевые моменты**:
1. ✅ `partialContext` накапливает данные через rounds
2. ✅ `clarificationRound` отслеживает количество попыток
3. ✅ Max rounds protection предотвращает бесконечные циклы
4. ✅ После success → reset counter для следующего workflow

---

## Cancel Detection

**Принцип**: User может отменить workflow в ЛЮБОЙ момент через natural language.

**Реализация**: Через system prompt + LLM intent parsing (implicit routing).

**Production Example**: [career-collector-agent.ts:311-390](../../../../src/facade/langchain/career-collector-agent.ts#L311)

```typescript
const SYSTEM_PROMPT = `
═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
1. Respond: "Workflow cancelled. Your data was not saved."
2. DO NOT call any tools
3. Stop workflow

Examples:
- User: "cancel" → YOU: "Workflow cancelled."
- User: "stop this" → YOU: "Workflow cancelled."
- User: "отмена" → YOU: "Workflow cancelled."

═══════════════════════════════════════════════════
AFTER CLARIFICATION (status="awaiting_clarification")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CANCEL intent:
   - Keywords: "cancel", "stop", "quit", "abort"
   - Action: Cancel workflow (see above)

2. ANSWERS intent:
   - User provides answers to questions
   - Action: Call extract_user_context with their answers
`;
```

**Как работает**:
1. User говорит "cancel"
2. LLM парсит intent через system prompt
3. LLM НЕ вызывает tools
4. LLM отвечает напрямую: "Workflow cancelled"
5. Workflow останавливается

**Альтернатива** (через tool):
```typescript
const cancelWorkflow = tool(
  async () => {
    return new Command({
      update: { status: "cancelled" },
      goto: END
    });
  },
  {
    name: "cancel_workflow",
    description: "Cancel current workflow. User wants to stop."
  }
);

// В system prompt:
// If user says "cancel" → Call cancel_workflow
```

---

## Gotchas

### ❌ Consistent Interrupt Order

**Проблема**: Interrupts должны вызываться в одинаковом порядке каждый раз.

```typescript
// ❌ НЕПРАВИЛЬНО - порядок меняется
async function nodeA(state: State) {
  const name = interrupt("What's your name?");

  // Conditionally skip interrupt
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

**Причина**: LangGraph матчит resume values по strict index order.

---

### ❌ Non-Idempotent Operations Before Interrupt

**Проблема**: Node re-executes при resume. Операции должны быть idempotent.

```typescript
// ❌ НЕПРАВИЛЬНО - добавляет дубликаты при resume
async function nodeA(state: State) {
  await db.appendToHistory(state.userId, "approval_requested");

  const approved = interrupt("Approve this change?");

  return { approved };
}

// ✅ ПРАВИЛЬНО - idempotent check
async function nodeA(state: State) {
  // Check если уже добавили
  const exists = await db.checkHistoryExists(state.userId, "approval_requested");
  if (!exists) {
    await db.appendToHistory(state.userId, "approval_requested");
  }

  const approved = interrupt("Approve this change?");

  return { approved };
}
```

**Причина**: Node re-runs from beginning при resume.

---

### ❌ Try-Catch Around Interrupt

**Проблема**: Try-catch ловит interrupt exception.

```typescript
// ❌ НЕПРАВИЛЬНО - interrupt не доходит до runtime
async function nodeA(state: State) {
  try {
    const name = interrupt("What's your name?");
  } catch (err) {
    console.error(err); // Ловит interrupt exception!
  }
  return state;
}

// ✅ ПРАВИЛЬНО - re-throw interrupt
async function nodeA(state: State) {
  try {
    const name = interrupt("What's your name?");
  } catch (err) {
    if (err.name === "Interrupt") {
      throw err; // Re-throw interrupt!
    }
    console.error(err);
  }
  return state;
}
```

---

## Checklist

- [ ] ✅ Checkpointer подключен ([см. glossary](../glossary.md#checkpointer-required))
- [ ] ✅ thread_id используется для всей сессии
- [ ] ✅ interruptOn указывает правильные tool names
- [ ] ✅ State schema содержит status + round counter
- [ ] ✅ Max rounds protection реализован
- [ ] ✅ Cancel detection через system prompt
- [ ] ✅ Resume использует Command({ resume })
- [ ] ✅ Consistent interrupt order
- [ ] ✅ Idempotent operations before interrupt
- [ ] ✅ No bare try-catch around interrupt()

**См. также**:
- [glossary.md#humanintheloopmiddleware](../glossary.md#humanintheloopmiddleware) - Middleware API
- [glossary.md#interrupt](../glossary.md#interrupt) - interrupt() function
- [concepts/routing.md](#) - Hybrid routing с interrupts
- [concepts/checkpointers.md](#) - Setup PostgresSaver
- [Production Example](../../../../src/facade/langchain/career-collector-agent.ts) - Полный multi-round workflow
