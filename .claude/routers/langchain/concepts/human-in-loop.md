# Human-in-the-Loop в LangChain v1.0

**Назначение**: Как остановить execution для получения user input (interrupts, confirmations, clarifications).

**Когда читать**: При проектировании workflows с user confirmations или multi-round dialogs.

---

## Три способа interrupts

### 1. ✅ Agent-driven Decision (Recommended для Chat UI)

**Принцип**: Tool использует `interrupt()` для паузы, Agent (LLM) сам парсит user response и решает какую tool вызвать.

**Когда использовать**:
- ✅ Chat UI (LibreChat, Telegram text) — user отвечает естественным языком
- ✅ Когда user responses непредсказуемы ("да", "ок", "норм", "погнали")
- ✅ Когда нужна гибкость в интерпретации intent

**Setup**:
```typescript
import { interrupt } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { Command, MemorySaver } from "@langchain/langgraph";

// Tool ПОКАЗЫВАЕТ данные и ставит на паузу (НЕ парсит!)
const showPlanTool = tool(
  async ({ plan }, runtime) => {
    // interrupt() для ПАУЗЫ
    const userMessage = interrupt({
      type: "confirmation",
      message: "Подтвердите план:",
      plan,
    });

    // Tool НЕ парсит! Просто передаёт в state
    return new Command({
      update: {
        phase: "awaiting_decision",
        userResponse: String(userMessage),
        messages: [new ToolMessage({
          content: `Пользователь ответил: "${userMessage}"`,
          tool_call_id: runtime.toolCallId
        })],
      },
    });
  },
  { name: "show_plan", ... }
);

// Отдельные tools для действий
const confirmPlanTool = tool(...);   // Вызывается Agent'ом при approve
const cancelWorkflowTool = tool(...); // Вызывается Agent'ом при reject
const editPlanTool = tool(...);       // Вызывается Agent'ом при edit

const agent = createAgent({
  model: "gpt-4o-mini",
  tools: [showPlanTool, confirmPlanTool, cancelWorkflowTool, editPlanTool],
  checkpointer: new MemorySaver(),
  // NO middleware!
  systemPrompt: SYSTEM_PROMPT_WITH_INTENT_PARSING,
});
```

**System Prompt для intent parsing**:
```typescript
const SYSTEM_PROMPT = `
═══════════════════════════════════════════════════════════════
ПОСЛЕ ПОКАЗА ДАННЫХ (phase="awaiting_decision")
═══════════════════════════════════════════════════════════════

Прочитай userResponse и определи намерение пользователя:

A. APPROVE intent (согласие):
   - Слова: "да", "yes", "ok", "подтверждаю", "согласен", "верно"
   - Действие: вызови confirm_plan

B. REJECT intent (отказ):
   - Слова: "нет", "no", "отмена", "cancel", "стоп"
   - Действие: вызови cancel_workflow

C. EDIT intent (изменение):
   - Слова: "измени", "edit", "поправь", содержит конкретные изменения
   - Действие: вызови edit_plan

ТЫ (LLM) анализируешь естественный язык и решаешь какую tool вызвать!
`;
```

**Resume**:
```typescript
// При resume просто передаём user message
const result = await agent.invoke(
  new Command({ resume: "да, подтверждаю" }),  // Просто строка!
  config
);
```

**Как работает**:
1. Tool вызывает `interrupt()` → показывает данные → ПАУЗА
2. User отвечает ("да, подтверждаю")
3. Resume: `Command({ resume: "да, подтверждаю" })`
4. Tool получает message → кладёт в `state.userResponse`
5. Agent видит `userResponse` → **сам парсит NLP** → вызывает `confirm_plan`

**POC**: [`poc/agent-decides-after-interrupt.ts`](../../../../poc/agent-decides-after-interrupt.ts)

**Production**: → [ADR-009](../../../../docs/facade/decisions/ADR-009-hitl-decision-transport.md)

---

### 2. humanInTheLoopMiddleware (Для structured UI)

**Принцип**: Middleware прерывает execution ДО выполнения tool. Требует explicit decision.

**Когда использовать**:
- ✅ Web UI с кнопками [Approve] [Edit] [Reject]
- ✅ Telegram с inline keyboard
- ✅ Когда UI гарантирует structured response

**Setup**:
```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";

const agent = createAgent({
  model: "gpt-4o-mini",
  tools: [confirmPlan, editPlan, cancelWorkflow],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        confirm_plan: true,
        edit_plan: true,
      }
    })
  ],
  checkpointer: postgresService.getCheckpointer(),
});
```

**Resume** (требует explicit decision):
```typescript
// Middleware требует structured HITLResponse
await agent.invoke(
  new Command({
    resume: { decisions: [{ type: "approve" }] }  // explicit!
  }),
  config
);
```

**Проблема**: Для Chat UI нужно парсить NLP → decision где-то (backend regex или MCP client).

---

### 3. interrupt() в Functional API

**Принцип**: Явный вызов `interrupt()` внутри node (не tool).

**Когда использовать**:
- ✅ StateGraph с custom nodes
- ✅ Functional API (task, entrypoint)

**Setup**:
```typescript
import { interrupt } from "@langchain/langgraph";
import { StateGraph } from "@langchain/langgraph";

const reviewNode = async (state) => {
  const approved = interrupt("Do you approve?");
  // approved = значение из Command({ resume })
  return { approved };
};
```

---

## Сравнение подходов

| Аспект | Agent-driven | Middleware | Functional |
|--------|-------------|------------|------------|
| Парсинг NLP | Agent (LLM) | External code (regex) | Node code |
| Resume format | `resume: "да"` | `resume: { decisions }` | `resume: any` |
| Гибкость | ✅ Высокая | ❌ Структурированный | ✅ Высокая |
| Chat UI | ✅ Идеально | ⚠️ Нужен парсер | ✅ Работает |
| Button UI | ⚠️ Избыточно | ✅ Идеально | ✅ Работает |
| Complexity | ✅ Простой | ⚠️ Сложнее | ⚠️ Сложнее |

**Рекомендация**:
- Chat UI (LibreChat, Telegram text) → **Agent-driven**
- Web UI с кнопками → **Middleware**
- Custom StateGraph → **Functional**

---

## Multi-Round Pattern

**Принцип**: Iterative data collection с накоплением state + max rounds protection.

### State Schema

```typescript
const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  partialContext: userContextSchemaPartial.optional(),
  contexts: z.array(userContextSchema).optional(),
  phase: z.enum([
    "collecting",
    "awaiting_confirmation",
    "complete",
    "failed"
  ]).optional(),
  userResponse: z.string().optional(),        // Для Agent-driven
  clarificationRound: z.number().default(0),
});
```

### Flow

```typescript
// Round 1: Partial data
const extractTool = tool(async ({ text }, runtime) => {
  const { partialContext, clarificationRound = 0 } = runtime.state;

  const newPartial = await extractData(text);
  const merged = { ...partialContext, ...newPartial };

  const validation = schema.safeParse(merged);

  if (!validation.success) {
    const round = clarificationRound + 1;

    // Max rounds protection
    if (round > MAX_ROUNDS) {
      return new Command({
        update: { phase: "failed" },
      });
    }

    return new Command({
      update: {
        partialContext: merged,
        clarificationRound: round,
        phase: "awaiting_clarification",
      },
    });
  }

  return new Command({
    update: {
      contexts: [validation.data],
      phase: "awaiting_confirmation",
    },
  });
});
```

---

## Cancel Detection

**Принцип**: User может отменить workflow через natural language.

**Реализация**: Через system prompt + LLM intent parsing.

```typescript
const SYSTEM_PROMPT = `
═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"отмена":
1. Respond: "Workflow cancelled."
2. DO NOT call any tools
3. Stop workflow
`;
```

---

## Gotchas

### ❌ Consistent Interrupt Order

```typescript
// ❌ НЕПРАВИЛЬНО - порядок меняется
async function nodeA(state) {
  const name = interrupt("Name?");
  if (state.needsAge) {
    const age = interrupt("Age?"); // Порядок меняется!
  }
  const city = interrupt("City?");
}

// ✅ ПРАВИЛЬНО - порядок всегда одинаковый
async function nodeA(state) {
  const name = interrupt("Name?");
  const age = interrupt("Age?");
  const city = interrupt("City?");
}
```

### ❌ Non-Idempotent Operations Before Interrupt

```typescript
// ❌ НЕПРАВИЛЬНО - дубликаты при resume
async function nodeA(state) {
  await db.append("requested");  // Дублируется!
  const approved = interrupt("Approve?");
}

// ✅ ПРАВИЛЬНО - idempotent check
async function nodeA(state) {
  if (!(await db.exists("requested"))) {
    await db.append("requested");
  }
  const approved = interrupt("Approve?");
}
```

### ❌ Try-Catch Around Interrupt

```typescript
// ❌ НЕПРАВИЛЬНО
try {
  const name = interrupt("Name?");
} catch (err) {
  console.error(err); // Ловит interrupt!
}

// ✅ ПРАВИЛЬНО
try {
  const name = interrupt("Name?");
} catch (err) {
  if (err.name === "Interrupt") throw err;
  console.error(err);
}
```

---

## Checklist

**Agent-driven (Chat UI)**:
- [ ] Tool использует `interrupt()` для паузы
- [ ] Tool кладёт `userResponse` в state (НЕ парсит!)
- [ ] System prompt содержит intent parsing секцию
- [ ] Отдельные tools для approve/edit/reject
- [ ] Checkpointer подключен
- [ ] Resume: `Command({ resume: userMessage })`

**Middleware (Button UI)**:
- [ ] `humanInTheLoopMiddleware` с `interruptOn`
- [ ] Checkpointer подключен
- [ ] Resume: `Command({ resume: { decisions } })`
- [ ] External parser для Chat UI (если нужен)

**Общее**:
- [ ] thread_id для всей сессии
- [ ] Max rounds protection
- [ ] Cancel detection в system prompt
- [ ] Consistent interrupt order
- [ ] Idempotent operations
- [ ] No bare try-catch

---

## См. также

- [ADR-009](../../../../docs/facade/decisions/ADR-009-hitl-decision-transport.md) — Production решение
- [POC](../../../../poc/agent-decides-after-interrupt.ts) — Agent-driven пример
- [glossary.md](../glossary.md#interrupt) — interrupt() API
- [checkpointers.md](./checkpointers.md) — Setup PostgresSaver
