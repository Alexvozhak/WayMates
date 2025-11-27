# Routing в LangChain v1.0

**Назначение**: Как агент решает, какой tool/node вызывать следующим.

**Когда читать**: При проектировании workflow с условными переходами.

---

## Три вида routing

### 1. Explicit Routing (goto)

**Принцип**: Tool **явно** указывает следующий шаг через `Command.goto`.

**Когда**: Deterministic business logic, валидация, error handling.

```typescript
import { Command } from "@langchain/langgraph";

const extractUserContext = tool(async ({ text }) => {
  const validation = userContextSchema.safeParse(data);

  if (!validation.success) {
    // Explicit routing - всегда идем на ask_clarification
    return new Command({
      update: { partial: data },
      goto: "ask_clarification"
    });
  }

  // Explicit routing - всегда идем на confirm_career_data
  return new Command({
    update: { contexts: [validation.data] },
    goto: "confirm_career_data"
  });
});
```

**Преимущества**:
- ✅ Deterministic - один input → один flow path
- ✅ Testable - легко unit-test routing logic
- ✅ Production-ready - предсказуемое поведение

**Недостатки**:
- ❌ Не гибкий - не адаптируется к user intent

---

### 2. Implicit Routing (LLM)

**Принцип**: LLM **сам решает**, какой tool вызвать, на основе system prompt.

**Когда**: User intent parsing, natural language понимание.

```typescript
const systemPrompt = `
AFTER CONFIRMATION (status="awaiting_confirmation"):

User response → interpret intent:

1. CONFIRM intent:
   - Keywords: "yes", "да", "ok", "correct", "👍"
   - Action: Call save_career_data

2. CORRECTION intent:
   - User provides changes: "change X to Y", "update position"
   - Action: Call extract_user_context with correction text

3. CANCEL intent:
   - Keywords: "cancel", "stop", "quit"
   - Action: Cancel workflow
`;

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [extractUserContext, saveCareerData],
  systemPrompt
});
```

**Преимущества**:
- ✅ Гибкий - понимает natural language
- ✅ Адаптивный - handling edge cases через LLM reasoning

**Недостатки**:
- ❌ Non-deterministic - зависит от LLM mood
- ❌ Сложно тестировать - нужны integration tests
- ❌ Может ошибиться - LLM может выбрать неправильный tool

---

### 3. Hybrid Routing (Recommended)

**Принцип**: Deterministic goto для business logic + LLM для user intent.

**Когда**: Production workflows с multi-step logic И user interaction.

```typescript
// === EXPLICIT ROUTING: Business Logic ===

const extractUserContext = tool(async ({ text }, { state }) => {
  const validation = userContextSchema.safeParse(data);

  if (!validation.success) {
    // Deterministic: валидация failed → goto ask_clarification
    return new Command({
      goto: "ask_clarification"
    });
  }

  // Deterministic: валидация success → goto confirm_career_data
  return new Command({
    goto: "confirm_career_data"
  });
});

// === IMPLICIT ROUTING: User Intent ===

const systemPrompt = `
YOUR ROLE: Interpret user intent + follow tool routing

AFTER CONFIRMATION (status="awaiting_confirmation"):
User response → interpret intent:

1. CONFIRM intent → Call save_career_data
2. CORRECTION intent → Call extract_user_context
3. CANCEL intent → Cancel workflow
`;

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [
    extractUserContext,    // Uses explicit goto
    askClarification,      // Middleware interrupt
    confirmCareerData,     // Middleware interrupt
    saveCareerData         // Uses goto END
  ],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,    // Pause here
        confirm_career_data: true   // Pause here
      }
    })
  ],
  systemPrompt
});
```

**Workflow**:
```
User: "I worked as Senior Engineer at Google"
  ↓
Agent: Calls extract_user_context (LLM choice)
  ↓
extractUserContext: Validation failed → goto "ask_clarification" (EXPLICIT)
  ↓
Middleware: Interrupt на ask_clarification (PAUSE)
  ↓
Agent returns: { status: "awaiting_clarification", message: "Questions..." }
  ↓
User: "Python, React, 3 years"
  ↓
Agent: Interprets as ANSWERS intent → calls extract_user_context (IMPLICIT)
  ↓
extractUserContext: Validation success → goto "confirm_career_data" (EXPLICIT)
  ↓
Middleware: Interrupt на confirm_career_data (PAUSE)
  ↓
Agent returns: { status: "awaiting_confirmation", message: "Preview..." }
  ↓
User: "yes"
  ↓
Agent: Interprets as CONFIRM intent → calls save_career_data (IMPLICIT)
  ↓
saveCareerData: Saves to DB → goto END (EXPLICIT)
  ↓
Workflow complete
```

**Преимущества**:
- ✅ Deterministic где нужно (business logic)
- ✅ Гибкий где нужно (user intent)
- ✅ Production-ready - баланс между reliability и flexibility

---

## Decision Matrix

| Ситуация | Routing Type | Почему |
|----------|--------------|--------|
| Валидация данных | Explicit (goto) | Deterministic - success/fail |
| Error handling | Explicit (goto) | Deterministic - known error paths |
| Max rounds check | Explicit (goto) | Deterministic - business rule |
| User says "yes"/"no" | Implicit (LLM) | Natural language understanding |
| User says "change X to Y" | Implicit (LLM) | Intent parsing |
| User says "cancel" | Implicit (LLM) | Intent parsing |
| Save to DB success | Explicit (goto END) | Deterministic - workflow complete |
| Multi-step workflow | Hybrid | Combine both approaches |

---

## Production Example

**Source**: [career-collector-agent.ts:182-209](../../../../src/facade/langchain/career-collector-agent.ts#L182)

```typescript
function createExtractUserContextTool(deps: CareerCollectorDeps) {
  return tool(
    async ({ text }, toolConfig: { state: AgentState }) => {
      const { partialContext, clarificationRound = 0 } = toolConfig.state;

      const newPartial = await extractSingleContextTool.invoke({ text });
      if (!newPartial) {
        // EXPLICIT: Parse failed → ask_clarification
        return new Command({
          update: { status: "awaiting_clarification" },
          goto: "ask_clarification"
        });
      }

      const merged = partialContext
        ? mergePartialWithAnswers(partialContext, newPartial)
        : newPartial;

      const validation = userContextSchema.safeParse(merged);

      if (!validation.success) {
        const round = clarificationRound + 1;
        const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

        if (round > maxRounds) {
          // EXPLICIT: Max rounds → END (fail)
          return new Command({
            update: { status: "failed" },
            goto: END
          });
        }

        // EXPLICIT: Validation failed → ask_clarification
        return new Command({
          update: {
            partialContext: merged,
            clarificationRound: round,
            status: "awaiting_clarification"
          },
          goto: "ask_clarification"
        });
      }

      // EXPLICIT: Validation success → confirm_career_data
      const normalized = await normalizeValidatedContext(
        validation.data,
        deps.normalizer,
        deps.userId
      );

      return new Command({
        update: {
          contexts: [normalized],
          clarificationRound: 0,
          status: "awaiting_confirmation"
        },
        goto: "confirm_career_data"
      });
    },
    {
      name: "extract_user_context",
      description:
        "Extract and validate career context from user text. " +
        "Returns Command with deterministic goto routing.",
      schema: z.object({
        text: z.string().describe("User message with career data or answers")
      })
    }
  );
}
```

**Ключевые моменты**:
1. ✅ Все routing через `goto` - deterministic
2. ✅ Каждый code path имеет явный `goto`
3. ✅ Легко unit-test каждый branch
4. ✅ Business logic изолирован от LLM reasoning

**System Prompt** (implicit routing):

**Source**: [career-collector-agent.ts:311-390](../../../../src/facade/langchain/career-collector-agent.ts#L311)

```typescript
const SYSTEM_PROMPT = `
YOUR ROLE: Interpret user intent + follow tool routing

WORKFLOW (Hybrid Routing):
1. User provides career text → call extract_user_context
2. Tool routes via goto:
   - Validation failed → ask_clarification (deterministic)
   - Validation success → confirm_career_data (deterministic)
3. After interrupt resume → YOU decide next step (see below)

AFTER CLARIFICATION (status="awaiting_clarification"):
User response → interpret intent:
1. CANCEL intent → Cancel workflow
2. ANSWERS intent → Call extract_user_context

AFTER CONFIRMATION (status="awaiting_confirmation"):
User response → interpret intent:
1. CONFIRM intent → Call save_career_data
2. CORRECTION intent → Call extract_user_context
3. CANCEL intent → Cancel workflow
`;
```

**Ключевые моменты**:
1. ✅ LLM парсит user intent ("yes", "cancel", corrections)
2. ✅ LLM следует deterministic routing из tools
3. ✅ Clear separation: business logic (goto) vs user intent (LLM)

---

## Gotchas

### ❌ Забыли goto в tool

```typescript
// ❌ НЕПРАВИЛЬНО - tool обновил state, но не указал goto
const myTool = tool(async () => {
  return new Command({
    update: { validationSuccess: false }
    // NO goto - agent сам решает через system prompt!
  });
});
```

**Проблема**: Non-deterministic behavior. Agent может вызвать неправильный tool.

**Решение**: Всегда указывай `goto` для business logic.

---

### ❌ Implicit routing для error handling

```typescript
// ❌ НЕПРАВИЛЬНО - LLM решает что делать с ошибкой
const systemPrompt = `
If validationSuccess=false, call ask_clarification
`;

const myTool = tool(async () => {
  return new Command({
    update: { validationSuccess: false }
  });
});
```

**Проблема**: LLM может ошибиться и вызвать неправильный tool.

**Решение**: Используй explicit goto для error paths.

---

### ❌ Goto на несуществующий tool

```typescript
// ❌ НЕПРАВИЛЬНО - typo в имени tool
return new Command({
  goto: "cofirm_career_data" // Typo!
});
```

**Проблема**: Runtime error при вызове.

**Решение**: Используй constants для tool names:

```typescript
const TOOL_NAMES = {
  ASK_CLARIFICATION: "ask_clarification",
  CONFIRM_CAREER_DATA: "confirm_career_data"
} as const;

return new Command({
  goto: TOOL_NAMES.CONFIRM_CAREER_DATA
});
```

---

## Checklist

- [ ] ✅ Business logic → explicit goto
- [ ] ✅ User intent → implicit (LLM via system prompt)
- [ ] ✅ Error handling → explicit goto
- [ ] ✅ Validation → explicit goto
- [ ] ✅ Все goto указывают на реальные tools/nodes
- [ ] ✅ System prompt описывает implicit routing logic
- [ ] ✅ Unit tests для всех explicit routing paths

**См. также**:
- [glossary.md#hybrid-routing](../glossary.md#hybrid-routing) - Hybrid routing pattern
- [concepts/tools.md](#) - Command API в tools
- [concepts/human-in-loop.md](#) - Interrupts + resume routing
- [patterns/atomic-tools.md](#) - Atomic tools для explicit routing
