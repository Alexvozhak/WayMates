# Error Handling Patterns

**Назначение**: Обработка ошибок в LangChain v1.0 workflows.

**Когда**: Production agents с external dependencies (API, DB, validation).

---

## Pattern 1: Explicit goto для Known Errors

**Принцип**: Business logic errors → deterministic goto routing.

```typescript
const extractUserContext = tool(
  async ({ text }) => {
    try {
      const partial = await extractSingleContextTool.invoke({ text });

      if (!partial) {
        // Known error: Parse failed
        return new Command({
          update: { status: "awaiting_clarification" },
          goto: "ask_clarification"
        });
      }

      const validation = userContextSchema.safeParse(partial);

      if (!validation.success) {
        // Known error: Validation failed
        const round = clarificationRound + 1;
        if (round > maxRounds) {
          // Known error: Max rounds exceeded
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

      // Success path
      return new Command({
        goto: "confirm_career_data"
      });
    } catch (error) {
      // Unexpected error (см. Pattern 2)
      console.error("Unexpected error:", error);
      return new Command({
        update: { status: "failed", message: "Internal error occurred" },
        goto: END
      });
    }
  },
  { name: "extract_user_context", description: "...", schema: ... }
);
```

---

## Pattern 2: Try-Catch для Unexpected Errors

**Принцип**: Unexpected errors → log + graceful fallback.

```typescript
const saveCareerData = tool(
  async (_, { state }) => {
    try {
      await coreClient.upsertStory({ userId, contexts: state.contexts });

      return new Command({
        update: { status: "complete" },
        goto: END
      });
    } catch (error) {
      console.error("❌ Save failed:", error);

      return new Command({
        update: {
          status: "failed",
          message: "Failed to save data. Please try again."
        },
        goto: END
      });
    }
  },
  { name: "save_career_data", description: "...", schema: z.object({}) }
);
```

---

## Pattern 3: Max Rounds Protection

**Принцип**: Multi-round workflows → max rounds check для предотвращения infinite loops.

```typescript
const extractUserContext = tool(
  async ({ text }, { state }) => {
    const { clarificationRound = 0 } = state;

    // ... extraction logic ...

    if (!validation.success) {
      const round = clarificationRound + 1;
      const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

      // Max rounds protection
      if (round > maxRounds) {
        console.log(`❌ Max clarification rounds (${maxRounds}) exceeded`);
        return new Command({
          update: {
            status: "failed",
            message: "Could not collect valid data after multiple attempts."
          },
          goto: END
        });
      }

      // Continue clarification
      return new Command({
        update: { clarificationRound: round },
        goto: "ask_clarification"
      });
    }

    // Success - reset counter
    return new Command({
      update: { clarificationRound: 0 },
      goto: "confirm_career_data"
    });
  },
  { name: "extract_user_context", description: "...", schema: ... }
);
```

**Production**: [career-collector-agent.ts:204-206](../../../../src/facade/langchain/career-collector-agent.ts#L204)

---

## Checklist

- [ ] ✅ Known errors → explicit goto
- [ ] ✅ Unexpected errors → try-catch + log
- [ ] ✅ Multi-round workflows → max rounds protection
- [ ] ✅ Error messages user-friendly (не technical stack traces)
- [ ] ✅ Graceful fallback (goto END с status="failed")
- [ ] ✅ Console logs для debugging (`console.error`)

---

## См. также

- [concepts/routing.md](../concepts/routing.md) - Explicit goto routing
- [concepts/human-in-loop.md](../concepts/human-in-loop.md) - Max rounds pattern
