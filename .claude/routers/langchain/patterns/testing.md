# Testing Patterns для LangChain Agents

**Назначение**: Testing strategies для LangChain v1.0 agents и tools.

**Когда**: Production agents с business logic validation.

---

## Pattern 1: Unit Test Tools

**Принцип**: Test tool logic в изоляции (mock state + params).

```typescript
import { describe, it, expect, vi } from "vitest";

describe("extractUserContext", () => {
  it("should route to ask_clarification on validation failure", async () => {
    const tool = createExtractUserContextTool(mockDeps);

    const result = await tool.invoke(
      { text: "Incomplete data" },
      {
        state: {
          messages: [],
          clarificationRound: 0
        }
      }
    );

    expect(result).toBeInstanceOf(Command);
    expect(result.goto).toBe("ask_clarification");
    expect(result.update.clarificationRound).toBe(1);
  });

  it("should route to confirm_career_data on validation success", async () => {
    const tool = createExtractUserContextTool(mockDeps);

    const result = await tool.invoke(
      { text: "Senior Engineer at Google, Python, React, SF" },
      {
        state: {
          messages: [],
          clarificationRound: 0
        }
      }
    );

    expect(result).toBeInstanceOf(Command);
    expect(result.goto).toBe("confirm_career_data");
    expect(result.update.contexts).toHaveLength(1);
  });

  it("should fail after max rounds exceeded", async () => {
    const tool = createExtractUserContextTool(mockDeps);

    const result = await tool.invoke(
      { text: "Incomplete data" },
      {
        state: {
          messages: [],
          clarificationRound: 3 // Max rounds
        }
      }
    );

    expect(result.goto).toBe(END);
    expect(result.update.status).toBe("failed");
  });
});
```

---

## Pattern 2: Integration Test Agent

**Принцип**: Test full workflow с real agent + checkpointer.

```typescript
import { MemorySaver } from "@langchain/langgraph";

describe("CareerCollectorAgent", () => {
  it("should collect career data through multi-round clarification", async () => {
    const testCheckpointer = new MemorySaver();
    const agent = createCareerCollectorAgent({
      ...deps,
      checkpointer: testCheckpointer
    });

    const config = { configurable: { thread_id: "test-thread-1" } };

    // Round 1: Initial parse
    const result1 = await agent.invoke(
      {
        messages: [{ role: "user", content: "I worked at Google" }]
      },
      config
    );

    expect(result1.__interrupt__).toBeDefined();
    expect(result1.status).toBe("awaiting_clarification");

    // Round 2: Provide missing data
    const result2 = await agent.invoke(
      new Command({ resume: { role: "user", content: "Python, SF" } }),
      config
    );

    expect(result2.__interrupt__).toBeDefined();
    expect(result2.status).toBe("awaiting_confirmation");

    // Round 3: Confirm
    const result3 = await agent.invoke(
      new Command({ resume: { role: "user", content: "yes" } }),
      config
    );

    expect(result3.status).toBe("complete");
    expect(result3.contexts).toHaveLength(1);
  });
});
```

---

## Pattern 3: Mock External Dependencies

**Принцип**: Mock APIs, DB calls для predictable tests.

```typescript
const mockCoreClient = {
  client: {
    story: {
      upsertStory: vi.fn().mockResolvedValue({
        contexts: { contextIds: ["ctx-1"] },
        trails: { trailIds: [] }
      })
    }
  }
};

const mockNormalizer = {
  normalizeUserContext: vi.fn().mockResolvedValue({
    position: "Senior Engineer",
    skills: ["Python"],
    cityName: "San Francisco"
  })
};

const mockDeps = {
  normalizer: mockNormalizer,
  userId: "user-123",
  coreClient: mockCoreClient
};
```

---

## Checklist

- [ ] ✅ Unit tests для каждого tool (routing logic)
- [ ] ✅ Integration tests для full workflow
- [ ] ✅ Mock external dependencies (APIs, DB)
- [ ] ✅ Test max rounds protection
- [ ] ✅ Test error paths (validation failure, API errors)
- [ ] ✅ Test cancel detection (если реализовано)
- [ ] ✅ Use MemorySaver для integration tests (не production checkpointer)

---

## См. также

- [patterns/atomic-tools.md](./atomic-tools.md) - Testable atomic tools
- [patterns/error-handling.md](./error-handling.md) - Error paths testing
