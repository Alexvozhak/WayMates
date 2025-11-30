# Routing в LangChain v1.0

**Назначение**: Как агент решает, какой tool вызывать следующим.

**Когда читать**: При проектировании workflow с условными переходами.

---

## ⚠️ КРИТИЧНО: goto НЕ работает с createAgent

**`Command({ goto })` игнорируется в `createAgent` API!**

```typescript
// ❌ НЕ РАБОТАЕТ с createAgent
return new Command({
  update: { phase: "next" },
  goto: "confirm_data"  // ИГНОРИРУЕТСЯ!
});
```

**Причина**: `createAgent` использует упрощённый граф, все routing решения делает LLM.

**Решение**: Используй LLM routing через ToolMessage + tool descriptions (см. ниже).

**Альтернатива**: Для explicit routing используй `StateGraph` API напрямую.

**Проверено в POC**: `poc/goto-in-createagent.ts`, `poc/hybrid-interrupt.ts`

---

## LLM Routing (Recommended для createAgent)

### Принцип

Tool направляет LLM на следующий tool через:
1. **ToolMessage** — явное указание что делать дальше
2. **Tool description** — подсказка для LLM
3. **System prompt** — общие правила routing

### Пример

```typescript
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import type { ToolRuntime } from "@langchain/core/tools";

const processData = tool(
  async (_, runtime: ToolRuntime<MyState>) => {
    const validation = userContextSchema.safeParse(data);

    // ToolMessage направляет LLM на следующий tool
    return new Command({
      update: {
        phase: validation.success ? "awaiting_confirmation" : "awaiting_clarification",
        messages: [new ToolMessage({
          content: validation.success
            ? "Data extracted successfully. MUST call confirm_data NOW."
            : "Validation failed. MUST call ask_clarification NOW.",
          tool_call_id: runtime.toolCallId
        })]
      }
    });
  },
  {
    name: "process_data",
    // Description подсказывает LLM возможные следующие шаги
    description: "Process user data. After this, call confirm_data if success, or ask_clarification if failed."
  }
);
```

### System Prompt для User Intent

```typescript
const systemPrompt = `
═══════════════════════════════════════════════════
USER INTENT PARSING (after interrupt)
═══════════════════════════════════════════════════

When phase="awaiting_decision", read userResponse and determine intent:

A. APPROVE: "да", "yes", "ok" → call confirm_data
B. EDIT: "измени", "change" → call edit_data
C. CANCEL: "отмена", "cancel" → call cancel_workflow

YOU (LLM) analyze natural language and decide which tool to call!
`;
```

---

## Decision Matrix

| Ситуация | Как направлять LLM |
|----------|-------------------|
| После validation success | ToolMessage: "MUST call confirm_data NOW" |
| После validation failure | ToolMessage: "MUST call ask_clarification NOW" |
| User says "yes"/"да" | System prompt: APPROVE → call confirm_data |
| User says "change X" | System prompt: EDIT → call edit_data |
| User says "cancel" | System prompt: CANCEL → call cancel_workflow |
| All contexts processed | ToolMessage: "All done. Call confirm_final NOW" |

---

## Gotchas

### ❌ Только System Prompt (без ToolMessage)

```typescript
// ❌ НЕНАДЁЖНО - LLM может проигнорировать
systemPrompt: `If validation fails, call ask_clarification`;
return new Command({ update: { validationFailed: true } });

// ✅ ПРАВИЛЬНО - ToolMessage + description
return new Command({
  update: {
    messages: [new ToolMessage({
      content: "Validation failed. MUST call ask_clarification NOW.",
      tool_call_id: runtime.toolCallId
    })]
  }
});
```

### ❌ Забыли ToolMessage

```typescript
// ❌ НЕПРАВИЛЬНО - Agent не знает что делать дальше
return new Command({
  update: { phase: "next" }
});

// ✅ ПРАВИЛЬНО - явно направляем LLM
return new Command({
  update: {
    phase: "next",
    messages: [new ToolMessage({
      content: "Now call next_step.",
      tool_call_id: runtime.toolCallId
    })]
  }
});
```

---

## Checklist

- [ ] ✅ Не используешь `goto` с `createAgent`
- [ ] ✅ ToolMessage указывает следующий tool
- [ ] ✅ Tool description описывает возможные следующие шаги
- [ ] ✅ System prompt обрабатывает user intent после interrupt
- [ ] ✅ Используешь `ToolRuntime<State>` для `toolCallId`

---

## См. также

- [gotchas.md#15](../reference/gotchas.md#15-goto-не-работает-с-createagent) — goto не работает
- [gotchas.md#13](../reference/gotchas.md#13-command-без-toolmessage--undefined-error) — ToolMessage обязателен
- [glossary.md](../glossary.md#llm-routing-вместо-goto) — LLM Routing паттерн
- [human-in-loop.md](./human-in-loop.md) — Agent-driven decision parsing
