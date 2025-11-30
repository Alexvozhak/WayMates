# Atomic Tools Pattern

**Назначение**: ONE tool = ONE entity operation. Agent видит каждый шаг workflow.

**Когда**: Production multi-step workflows с visibility требованиями.

---

## Проблема: Orchestrator Tool

```typescript
// ❌ НЕПРАВИЛЬНО - orchestrator tool скрывает steps от agent
const extractCareerData = tool(async ({ text }) => {
  const partial = await extract(text);

  if (!isValid(partial)) {
    return askQuestions();  // Agent НЕ ВИДИТ!
  }

  await save(partial);  // Agent НЕ ВИДИТ!
  return { success: true };
});
```

**Последствия**:
- ❌ Agent не контролирует flow
- ❌ Нет visibility в промежуточные шаги
- ❌ Сложно unit-test
- ❌ Нет переиспользования

---

## Решение: Atomic Tools + ToolMessage

```typescript
import { ToolMessage } from "@langchain/core/messages";
import type { ToolRuntime } from "@langchain/core/tools";

// Tool 1: Extract + Validate → направляет LLM
const extractUserContext = tool(
  async ({ text }, runtime: ToolRuntime<MyState>) => {
    const partial = await extract(text);
    const validation = schema.safeParse(partial);

    // ToolMessage направляет LLM на следующий tool
    return new Command({
      update: {
        partial: validation.success ? null : partial,
        data: validation.success ? validation.data : null,
        messages: [new ToolMessage({
          content: validation.success
            ? "Data extracted. Now call confirm_data."
            : "Validation failed. Now call ask_clarification.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  {
    name: "extract_user_context",
    description: "Extract data. After this, call confirm_data or ask_clarification.",
    schema: z.object({ text: z.string() })
  }
);

// Tool 2: Ask Clarification (ATOMIC - только вопросы)
const askClarification = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    const questions = buildQuestions(runtime.state.partial);
    return new Command({
      update: {
        phase: "awaiting_clarification",
        message: formatQuestions(questions),
        messages: [new ToolMessage({
          content: "Questions sent. Wait for user response.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  { name: "ask_clarification", description: "Ask clarification questions.", schema: z.object({}) }
);

// Tool 3: Confirm Data (ATOMIC - только confirmation)
const confirmData = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    const preview = formatPreview(runtime.state.data);
    return new Command({
      update: {
        phase: "awaiting_confirmation",
        message: preview,
        messages: [new ToolMessage({
          content: "Data shown for confirmation. Wait for user response.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  { name: "confirm_data", description: "Show data for confirmation.", schema: z.object({}) }
);

// Tool 4: Save (ATOMIC - только save)
const saveData = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    await db.save(runtime.state.data);
    return new Command({
      update: {
        phase: "complete",
        messages: [new ToolMessage({
          content: "Data saved successfully.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  { name: "save_data", description: "Save data to database.", schema: z.object({}) }
);
```

---

## Преимущества

1. **Agent Visibility**: Agent видит каждый шаг в messages history
2. **Testability**: Unit-test каждый tool изолированно
3. **Reusability**: 70-85% переиспользование в production
4. **Debuggability**: Clear trace через messages
5. **LLM Routing**: ToolMessage явно направляет LLM

---

## Checklist

- [ ] ✅ Один tool = одна операция
- [ ] ✅ ToolMessage в каждом Command
- [ ] ✅ Tool description указывает следующие шаги
- [ ] ✅ Используешь `ToolRuntime<State>` для toolCallId
- [ ] ✅ Не используешь `goto` с `createAgent`

---

## См. также

- [tools.md](./tools.md) — Tool API reference
- [routing.md](./routing.md) — LLM Routing через ToolMessage
- [gotchas.md#15](../reference/gotchas.md#15-goto-не-работает-с-createagent) — goto не работает
