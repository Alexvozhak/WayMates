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
    // Agent НЕ ВИДИТ что мы задаем вопросы!
    return askQuestions();
  }

  if (!isConfirmed(partial)) {
    // Agent НЕ ВИДИТ confirmation step!
    return confirm(partial);
  }

  // Agent НЕ ВИДИТ save operation!
  await save(partial);
  return { success: true };
});
```

**Последствия**:
- ❌ Agent не контролирует flow
- ❌ Нет visibility в промежуточные шаги
- ❌ Сложно unit-test
- ❌ Нет переиспользования

---

## Решение: Atomic Tools

```typescript
// ✅ ПРАВИЛЬНО - каждый шаг = отдельный tool

// Tool 1: Extract + Validate
const extractUserContext = tool(
  async ({ text }) => {
    const partial = await extract(text);
    const validation = schema.safeParse(partial);

    if (!validation.success) {
      return new Command({
        update: { partial },
        goto: "ask_clarification"  // Explicit routing
      });
    }

    return new Command({
      update: { data: validation.data },
      goto: "confirm_career_data"
    });
  },
  { name: "extract_user_context", description: "...", schema: ... }
);

// Tool 2: Ask Clarification (ATOMIC - только вопросы)
const askClarification = tool(
  async (_, { state }) => {
    const questions = buildQuestions(state.partial);
    return new Command({
      update: {
        status: "awaiting_clarification",
        message: formatQuestions(questions)
      }
    });
  },
  { name: "ask_clarification", description: "...", schema: z.object({}) }
);

// Tool 3: Confirm Data (ATOMIC - только confirmation)
const confirmCareerData = tool(
  async (_, { state }) => {
    const preview = formatPreview(state.contexts);
    return new Command({
      update: {
        status: "awaiting_confirmation",
        message: preview
      }
    });
  },
  { name: "confirm_career_data", description: "...", schema: z.object({}) }
);

// Tool 4: Save (ATOMIC - только save)
const saveCareerData = tool(
  async (_, { state }) => {
    await coreClient.upsertStory({ userId, contexts: state.contexts });
    return new Command({
      update: { status: "complete" },
      goto: END
    });
  },
  { name: "save_career_data", description: "...", schema: z.object({}) }
);
```

---

## Преимущества

1. **Agent Visibility**: Agent видит каждый шаг в messages history
2. **Testability**: Unit-test каждый tool изолированно
3. **Reusability**: 70-85% переиспользование в production
4. **Debuggability**: Clear trace через messages
5. **Explicit Routing**: goto делает flow deterministic

---

## Production Example

**Source**: [career-collector-agent.ts:398-402](../../../../src/facade/langchain/career-collector-agent.ts#L398)

```typescript
tools: [
  createExtractUserContextTool(deps),  // Atomic: extract + validate + route
  askClarificationTool,                // Atomic: только вопросы
  confirmCareerDataTool,               // Atomic: только confirmation
  createSaveCareerDataTool({ coreClient }) // Atomic: только save
]
```

**Reusability**: `askClarificationTool` и `confirmCareerDataTool` используются в shared-tools и переиспользуются в разных agents.

---

## Metrics

**WayMates Production Stats**:
- `extractSingleContextTool`: 85% reuse (3+ agents)
- `askClarificationTool`: 70% reuse (2+ agents)
- `confirmCareerDataTool`: 70% reuse (2+ agents)

---

## См. также

- [glossary.md#atomic-tools-pattern](../glossary.md#atomic-tools-pattern) - Pattern overview
- [concepts/routing.md](../concepts/routing.md) - Explicit routing с goto
- [concepts/tools.md](../concepts/tools.md) - Command API
