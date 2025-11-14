# LangGraph TypeScript Implementation Guide

**Last Updated**: 2025-11-14
**Target**: WayMates Facade Data Ingestion Workflow (Features #5-7)
**Level**: Moderate (patterns + examples + migration tips)

---

## Purpose

Practical guide для implementation LangGraph workflows в TypeScript. Адаптирован под WayMates Facade MCP patterns.

**NOT a tutorial**: См. [LangGraph.js Docs](https://langchain-ai.github.io/langgraphjs/) для полного tutorial.

**Goal**: Избежать common mistakes, использовать best practices, следовать project conventions.

---

## Table of Contents

1. [Interrupt Pattern](#1-interrupt-pattern-critical) ⚠️ **CRITICAL**
2. [Command Pattern](#2-command-pattern)
3. [State Annotation with Reducers](#3-state-annotation-with-reducers)
4. [Redis Checkpointer](#4-redis-checkpointer)
5. [Resume Workflow](#5-resume-workflow)
6. [Conditional Edges vs Dynamic Routing](#6-conditional-edges-vs-dynamic-routing)
7. [Send Pattern for Parallel Execution](#7-send-pattern-for-parallel-execution)
8. [Common Pitfalls](#8-common-pitfalls)

---

## 1. Interrupt Pattern (CRITICAL)

### Concept

`interrupt()` **останавливает выполнение графа**, вызывая `GraphInterrupt` exception. Граф сохраняет состояние в checkpoint и **ждёт возобновления**.

**КРИТИЧНО**: После `resume`, **node выполняется ЗАНОВО с начала**, НЕ продолжает с места interrupt!

### ❌ НЕПРАВИЛЬНО (В architecture.md)

```typescript
// ❌ WRONG - Node НЕ продолжается после interrupt!
async function clarify(state: State, config: RunnableConfig) {
  const questions = await facadeLLM.generateQuestions(state.errors);

  // interrupt() вызывает exception - код ниже НЕ ВЫПОЛНИТСЯ!
  const userAnswer = interrupt({
    type: 'clarification',
    questions
  });

  // ❌ Эта строка НИКОГДА не выполнится после interrupt
  return new Command({
    update: { messages: [...state.messages, userAnswer] },
    goto: 'extract'
  });
}
```

**Почему неправильно**:
- `interrupt()` бросает `GraphInterrupt` exception
- Execution stops немедленно
- После resume: node запускается **с начала**, не продолжает с места interrupt

### ✅ ПРАВИЛЬНО (Pattern 1: Check Resume Value)

```typescript
// ✅ CORRECT - Check if resumed
async function clarify(state: State, config: RunnableConfig) {
  // After resume, node starts from beginning
  // Check if we have resume value (user answered)
  if (state.resumeValue) {
    // User provided answer, continue workflow
    return new Command({
      update: {
        messages: [...state.messages, state.resumeValue],
        resumeValue: undefined, // Clear for next cycle
      },
      goto: 'extract'
    });
  }

  // First time (no resume value) - generate questions and interrupt
  const questions = await facadeLLM.generateQuestions(state.errors);

  // This throws GraphInterrupt exception - nothing after this line executes
  interrupt({
    type: 'clarification',
    questions
  });

  // Never reached on first invocation
  // After resume, node re-executes from top and hits the if (state.resumeValue) block
}
```

**Key Points**:
- ✅ Check `state.resumeValue` at начале node
- ✅ If present → user answered, continue workflow
- ✅ If NOT present → first time, generate questions and interrupt
- ✅ Clear `resumeValue` after processing

### ✅ ПРАВИЛЬНО (Pattern 2: Separate Flag)

```typescript
// State Annotation
const StateAnnotation = Annotation.Root({
  // ... other fields
  awaitingUserAnswer: Annotation<boolean>({
    default: () => false,
  }),
  userAnswer: Annotation<string | undefined>(),
});

// Clarify node
async function clarify(state: State, config: RunnableConfig) {
  // Check if user already answered (after resume)
  if (state.userAnswer) {
    // Process user answer
    return new Command({
      update: {
        messages: [...state.messages, state.userAnswer],
        awaitingUserAnswer: false,
        userAnswer: undefined, // Clear
      },
      goto: 'extract'
    });
  }

  // First time - generate questions
  const questions = await facadeLLM.generateQuestions(state.errors);

  // Mark as awaiting answer
  await updateState({ awaitingUserAnswer: true });

  // Interrupt (throws exception)
  interrupt({
    type: 'clarification',
    questions
  });
}
```

**Advantages**:
- ✅ Explicit flag (`awaitingUserAnswer`) for clarity
- ✅ Separate field for user input (`userAnswer`)
- ✅ Easy to debug (check flags in state)

### Resume Flow

```typescript
// Initial invocation (user starts workflow)
const result = await graph.invoke({ userId: "usr_123", message: "..." }, config);
// → Hits interrupt → returns { status: "waiting", thread_id: "...", question: "..." }

// Resume after user answers
const resumeResult = await graph.invoke(
  new Command({ resume: "User's answer here" }),
  config // SAME config (thread_id)
);
// → Node re-executes from beginning
// → state.resumeValue = "User's answer here"
// → Hits if (state.resumeValue) block
// → Continues to 'extract' node
```

### WayMates Application

В Facade Data Ingestion workflow:
- `clarify_semantic` node: Ask for missing required fields
- `clarify_schema` node: Ask to fix format errors
- `handle_normalization` node: Warn about unverified terms
- `confirm` node: Get final confirmation before persist

**State Annotation** должен include:
```typescript
const DataIngestionState = Annotation.Root({
  // ... other fields

  // For interrupt handling
  resumeValue: Annotation<string | undefined>(),

  // OR separate fields for each interrupt
  semanticAnswer: Annotation<string | undefined>(),
  schemaAnswer: Annotation<string | undefined>(),
  normalizationConfirmed: Annotation<boolean>(),
  userConfirmAction: Annotation<'accept' | 'corrections' | 'cancel' | undefined>(),
});
```

---

## 2. Command Pattern

### Rule

**ВСЕГДА** используйте `Command({update, goto})` для возврата из node, **НИКОГДА** plain object `{}`.

### ❌ НЕПРАВИЛЬНО

```typescript
// ❌ WRONG - plain object return
async function prepare(state: State) {
  const schema = await loadSchema();
  const dictionaries = await getDictionaries();

  return {
    schema,
    dictionaries
  };
}
```

**Почему неправильно**:
- Не explicit control flow
- Не работает с conditional routing
- Deprecated pattern

### ✅ ПРАВИЛЬНО

```typescript
// ✅ CORRECT - always use Command
async function prepare(state: State) {
  const schema = await loadSchema();
  const dictionaries = await getDictionaries();

  return new Command({
    update: {
      schema,
      dictionaries
    }
    // No 'goto' → continues to next node defined by edges
  });
}
```

### Command with Dynamic Routing

```typescript
// ✅ Dynamic routing based on state
async function semantic(state: State) {
  const errors = validateSemantic(state.extractedContext);

  if (errors.length > 0) {
    return new Command({
      update: { semanticErrors: errors },
      goto: 'clarify_semantic' // INTERRUPT
    });
  }

  // No errors → continue to schema validation
  return new Command({
    update: { semanticErrors: [] },
    goto: 'schema'
  });
}
```

### WayMates Application

Все nodes в Data Ingestion workflow используют `Command`:
- `prepare` → `Command({update: {schema, dictionaries}})`
- `extract` → `Command({update: {extractedContext}})`
- `semantic` → `Command({update: {...}, goto: errors ? 'clarify_semantic' : 'schema'})`
- `confirm` → `Command({update: {...}, goto: action === 'accept' ? 'persist' : 'extract'})`

---

## 3. State Annotation with Reducers

### Concept

**Reducers** определяют как **conflicting updates** merge в state. Критично для concurrent nodes или multi-turn updates.

### Reducer Types

| Reducer | Use Case | Behavior |
|---------|----------|----------|
| **CONCAT** | Arrays (append-only) | `(prev, next) => [...prev, ...next]` |
| **MERGE** | Objects (patch) | `(prev, next) => ({ ...prev, ...next })` |
| **REPLACE** | Simple values | `(prev, next) => next` |

### ✅ ПРАВИЛЬНО: CONCAT для messages

```typescript
const StateAnnotation = Annotation.Root({
  messages: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next], // CONCAT
  }),
});

// Node 1 adds message
return new Command({
  update: { messages: ['Hello'] }
});

// Node 2 adds another message
return new Command({
  update: { messages: ['World'] }
});

// Result: state.messages = ['Hello', 'World'] ✅
```

### ✅ ПРАВИЛЬНО: MERGE для extractedContext

```typescript
const StateAnnotation = Annotation.Root({
  extractedContext: Annotation<Partial<UserContext>>({
    default: () => ({}),
    reducer: (prev, next) => ({ ...prev, ...next }), // MERGE
  }),
});

// Turn 1: User says "Python Developer"
return new Command({
  update: {
    extractedContext: { position: 'Python Developer' }
  }
});

// Turn 2: User says "Moscow"
return new Command({
  update: {
    extractedContext: { city: 'Moscow' }
  }
});

// Result: state.extractedContext = { position: 'Python Developer', city: 'Moscow' } ✅
```

### ✅ ПРАВИЛЬНО: REPLACE для errors

```typescript
const StateAnnotation = Annotation.Root({
  semanticErrors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => next, // REPLACE (NOT concat!)
  }),
});

// Why REPLACE?
// Each validation produces NEW set of errors, not accumulates old ones

// Turn 1: Missing position + city
return new Command({
  update: {
    semanticErrors: ['Missing position', 'Missing city']
  }
});

// Turn 2: User provides position, but still missing city
return new Command({
  update: {
    semanticErrors: ['Missing city'] // NEW set, REPLACE old
  }
});

// Result: state.semanticErrors = ['Missing city'] ✅
// NOT ['Missing position', 'Missing city', 'Missing city'] ❌
```

### ❌ НЕПРАВИЛЬНО: CONCAT для errors

```typescript
// ❌ WRONG - will accumulate old errors
const StateAnnotation = Annotation.Root({
  semanticErrors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next], // ❌ WRONG for errors!
  }),
});

// Validation cycle 1
semanticErrors = ['Missing position']

// User fixes position, validation cycle 2
semanticErrors = ['Missing position', 'Missing city'] // ❌ OLD error still here!

// Validation cycle 3
semanticErrors = ['Missing position', 'Missing city', 'Missing city'] // ❌ Duplicates!
```

### WayMates State Annotation

```typescript
// src/facade/workflows/data-ingestion/types.ts
import { Annotation } from '@langchain/langgraph';

const DataIngestionState = Annotation.Root({
  // Input
  userId: Annotation<string>,

  // Messages (CONCAT - append conversation history)
  messages: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next], // CONCAT ✅
  }),

  // Extracted data (MERGE - accumulate fields across turns)
  extractedContext: Annotation<Partial<UserContext>>({
    default: () => ({}),
    reducer: (prev, next) => ({ ...prev, ...next }), // MERGE ✅
  }),

  // Validation errors (REPLACE - new set each validation)
  semanticErrors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => next, // REPLACE ✅
  }),
  schemaErrors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => next, // REPLACE ✅
  }),
  normalizationErrors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => next, // REPLACE ✅
  }),

  // Locked context (simple value, no reducer needed)
  lockedContext: Annotation<UserContext | undefined>(),
  previewGenerated: Annotation<boolean>({
    default: () => false,
  }),

  // Result
  contextId: Annotation<string | undefined>(),
});

export type DataIngestionState = typeof DataIngestionState.State;
```

---

## 4. Redis Checkpointer

### Setup Pattern

```typescript
// src/facade/workflows/data-ingestion/checkpointer.ts
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { createClient } from "redis";

// ✅ ONE client per application (singleton pattern)
class CheckpointerManager {
  private static instance: CheckpointerManager;
  private redisClient: ReturnType<typeof createClient>;
  private checkpointer: RedisSaver;

  private constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
  }

  static async getInstance(): Promise<CheckpointerManager> {
    if (!CheckpointerManager.instance) {
      CheckpointerManager.instance = new CheckpointerManager();
      await CheckpointerManager.instance.redisClient.connect();

      CheckpointerManager.instance.checkpointer = new RedisSaver(
        CheckpointerManager.instance.redisClient,
        {
          keyPrefix: "waymates:checkpoints:",
          ttl: 604800, // 7 days in seconds
        }
      );
    }
    return CheckpointerManager.instance;
  }

  getCheckpointer(): RedisSaver {
    return this.checkpointer;
  }
}

export { CheckpointerManager };
```

### Usage in Workflow

```typescript
// src/facade/workflows/data-ingestion/graph.ts
import { StateGraph } from '@langchain/langgraph';
import { CheckpointerManager } from './checkpointer.js';

const checkpointerManager = await CheckpointerManager.getInstance();
const checkpointer = checkpointerManager.getCheckpointer();

const workflow = new StateGraph(DataIngestionState)
  .addNode('prepare', prepare)
  .addNode('extract', extract)
  // ... other nodes
  .compile({ checkpointer }); // ✅ Pass checkpointer

// In WorkflowRunner
async function runWorkflow(userId: string, message: string, threadId?: string) {
  const config = {
    configurable: {
      thread_id: threadId || `thr_${uuidv7()}`,
    },
  };

  // Invoke workflow (checkpoints saved automatically)
  const result = await workflow.invoke({ userId, messages: [message] }, config);

  return result;
}
```

### Key Points

- ✅ **Один `redisClient` на приложение** (connection pool)
- ✅ **Один `RedisSaver` на приложение** (reusable)
- ✅ **TTL автоматический** (Redis `EXPIRE`, не нужен manual cleanup)
- ✅ **thread_id** уникален для каждого workflow instance
- ❌ **НЕ создавать новый RedisSaver** для каждого `graph.invoke()`

### vs SQLite Checkpointer

| Feature | RedisSaver | SqliteSaver |
|---------|------------|-------------|
| TTL | ✅ Automatic (`EXPIRE`) | ❌ Manual cleanup required |
| Distributed | ✅ Yes | ❌ File-based |
| Performance | ✅ In-memory | ⚠️ Disk I/O |
| Persistence | ⚠️ Requires AOF | ✅ Always persistent |
| Session Management | ✅ One client | ⚠️ New session per operation |

**WayMates Choice**: RedisSaver (TTL + distributed-ready + same Redis for dictionaries cache)

---

## 5. Resume Workflow

### Resume with Command

```typescript
import { Command } from '@langchain/langgraph';

// Resume after interrupt
const resumeResult = await workflow.invoke(
  new Command({ resume: userProvidedValue }),
  {
    configurable: {
      thread_id: existingThreadId, // SAME thread_id as interrupted workflow
    },
  }
);
```

### Resume Value in State

После resume, `resume` value доступен через:

**Option 1**: В `state.resumeValue` (если добавлено в State Annotation)

```typescript
const StateAnnotation = Annotation.Root({
  resumeValue: Annotation<string | undefined>(),
  // ... other fields
});

async function clarify(state: State) {
  if (state.resumeValue) {
    // Process resume value
    const answer = state.resumeValue;
    // ...
  }
}
```

**Option 2**: Через специализированные поля (preferred)

```typescript
const StateAnnotation = Annotation.Root({
  semanticAnswer: Annotation<string | undefined>(),
  schemaAnswer: Annotation<string | undefined>(),
  // ... other fields
});

async function clarify_semantic(state: State) {
  if (state.semanticAnswer) {
    // Process semantic answer
    // ...
  }
}
```

### WayMates Resume Flow

```typescript
// Turn 1: User starts add_experience
LibreChat → Facade: add_experience({ message: "...", session_id: "sess_abc" })
Facade → LangGraph: workflow.invoke({ userId, messages: [...] }, { thread_id: "thr_xyz" })
→ Hits interrupt at clarify_semantic
→ Returns: { status: "waiting", thread_id: "thr_xyz", question: "Missing: position, skills" }

// Turn 2: User answers (after 10 seconds)
LibreChat → Facade: add_experience({
  message: "Python Developer, FastAPI",
  thread_id: "thr_xyz", // SAME thread_id
  session_id: "sess_abc"
})
Facade → LangGraph: workflow.invoke(
  new Command({ resume: "Python Developer, FastAPI" }),
  { thread_id: "thr_xyz" } // SAME thread_id
)
→ clarify_semantic node re-executes from beginning
→ state.resumeValue = "Python Developer, FastAPI"
→ Continues to extract → semantic → ... → confirm
→ Hits interrupt at confirm
→ Returns: { status: "waiting", thread_id: "thr_xyz", question: "All correct? [preview]" }

// Turn 3: User confirms
LibreChat → Facade: add_experience({
  message: "Yes",
  thread_id: "thr_xyz",
  session_id: "sess_abc"
})
Facade → LangGraph: workflow.invoke(
  new Command({ resume: "Yes" }),
  { thread_id: "thr_xyz" }
)
→ confirm node re-executes
→ action = "accept"
→ Continues to persist → END
→ Returns: { status: "complete", context_id: "ctx_abc123" }
```

---

## 6. Conditional Edges vs Dynamic Routing

### Static Conditional Edges

**Use when**: Routing logic simple, paths известны ahead of time.

```typescript
// Router function (CANNOT modify state)
function routeAfterValidation(state: State): string {
  if (state.semanticErrors.length > 0) {
    return 'clarify_semantic';
  }
  return 'schema';
}

// Add to graph
const graph = new StateGraph(StateAnnotation)
  .addNode('semantic', semantic)
  .addNode('clarify_semantic', clarify_semantic)
  .addNode('schema', schema)
  .addConditionalEdges(
    'semantic', // From node
    routeAfterValidation, // Router function
    ['clarify_semantic', 'schema'] // Possible destinations (for visualization)
  );
```

**Limitations**:
- ❌ Router function **НЕ МОЖЕТ** modify state
- ❌ Routing decision made **AFTER** node completes

### Dynamic Routing with Command

**Use when**: Routing logic complex, need to modify state AND route.

```typescript
// Node uses Command for dynamic routing
async function semantic(state: State) {
  const errors = validateSemantic(state.extractedContext);

  if (errors.length > 0) {
    // ✅ Can update state AND route in one Command
    return new Command({
      update: { semanticErrors: errors },
      goto: 'clarify_semantic'
    });
  }

  return new Command({
    update: { semanticErrors: [] },
    goto: 'schema'
  });
}

// Add to graph (NO conditional edges needed!)
const graph = new StateGraph(StateAnnotation)
  .addNode('semantic', semantic)
  .addNode('clarify_semantic', clarify_semantic)
  .addNode('schema', schema);
  // Node 'semantic' handles routing itself via Command
```

**Advantages**:
- ✅ Update state AND route in one operation
- ✅ Routing logic colocated with validation logic
- ✅ No separate router function needed

### WayMates Pattern

В Data Ingestion workflow используем **Dynamic Routing with Command**:

```typescript
// semantic node
async function semantic(state: DataIngestionState) {
  const errors = validateSemantic(state.extractedContext);

  return new Command({
    update: { semanticErrors: errors },
    goto: errors.length > 0 ? 'clarify_semantic' : 'schema'
  });
}

// schema node
async function schema(state: DataIngestionState) {
  const errors = validateSchema(state.extractedContext);

  return new Command({
    update: { schemaErrors: errors },
    goto: errors.length > 0 ? 'clarify_schema' : 'canonicalize'
  });
}

// confirm node
async function confirm(state: DataIngestionState) {
  // After resume, check user action
  if (state.userConfirmAction === 'accept') {
    return new Command({
      update: {},
      goto: 'persist'
    });
  } else if (state.userConfirmAction === 'corrections') {
    return new Command({
      update: {},
      goto: 'extract' // Apply corrections to locked context
    });
  } else {
    // cancel
    return new Command({
      update: {},
      goto: END
    });
  }
}
```

**Rationale**: Validation logic + routing logic тесно связаны, лучше держать в одном месте.

---

## 7. Send Pattern for Parallel Execution

### Concept

`Send` pattern allows **dynamic fanout** - create edges to multiple nodes at runtime.

**Use case**: Map-reduce workflows, parallel processing of items.

### Example: Parallel Skill Normalization

```typescript
import { Send } from '@langchain/langgraph';

// State for individual skill normalization
const SkillNormalizationState = Annotation.Root({
  skill: Annotation<string>,
  canonical: Annotation<string | undefined>(),
  verified: Annotation<boolean>(),
});

// Fan-out node: create Send for each skill
async function fanOutSkills(state: DataIngestionState) {
  const skills = state.extractedContext.skills || [];

  // Create Send for each skill (parallel execution)
  return skills.map(
    (skill) => new Send('normalize_skill', { skill })
  );
}

// Worker node: normalize single skill
async function normalizeSkill(state: SkillNormalizationState) {
  const canonical = await normalizer.normalize(state.skill);

  return new Command({
    update: {
      canonical,
      verified: canonical !== undefined,
    }
  });
}

// Fan-in node: collect results
async function collectNormalizedSkills(state: DataIngestionState) {
  // All parallel tasks completed, results available
  // Aggregate logic here
  return new Command({
    update: {
      canonicalSkills: state.normalizedSkills,
    }
  });
}

// Graph
const graph = new StateGraph(DataIngestionState)
  .addNode('fanOutSkills', fanOutSkills)
  .addNode('normalize_skill', normalizeSkill)
  .addNode('collectNormalizedSkills', collectNormalizedSkills)
  .addConditionalEdges('fanOutSkills', (state) => {
    // Return Send[] for parallel execution
    return state.extractedContext.skills.map(
      (skill) => new Send('normalize_skill', { skill })
    );
  })
  .addEdge('normalize_skill', 'collectNormalizedSkills');
```

### WayMates Usage

**Current Design**: НЕ используем Send pattern (sequential validation).

**Potential Future Use**:
- Parallel normalization of position, skills, domains (instead of loop)
- Parallel WebSearch verification for multiple unknown terms

---

## 8. Common Pitfalls

### ❌ Pitfall 1: Try/Catch Around Interrupt

```typescript
// ❌ WRONG - catching interrupt exception
async function clarify(state: State) {
  try {
    const answer = interrupt({ question: "..." });
    return new Command({ update: { answer } });
  } catch (error) {
    // ❌ This breaks interrupt mechanism!
    console.error("Interrupt failed", error);
    return new Command({ update: {} });
  }
}
```

**Why wrong**: `interrupt()` MUST throw exception to pause workflow. Catching it breaks LangGraph mechanism.

**✅ Correct**: Never catch interrupt exceptions.

---

### ❌ Pitfall 2: Забыть Checkpointer

```typescript
// ❌ WRONG - no checkpointer
const graph = new StateGraph(StateAnnotation)
  .addNode('clarify', clarify)
  .compile(); // ❌ Missing checkpointer!

// Interrupt will NOT work!
await graph.invoke({ ... }); // ❌ Throws error or behaves incorrectly
```

**✅ Correct**: Always provide checkpointer for interrupt workflows.

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode('clarify', clarify)
  .compile({ checkpointer: redisSaver }); // ✅
```

---

### ❌ Pitfall 3: Wrong Reducer Type

```typescript
// ❌ WRONG - using CONCAT for errors
const StateAnnotation = Annotation.Root({
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next], // ❌ Accumulates old errors!
  }),
});
```

**✅ Correct**: Use REPLACE for validation errors.

```typescript
const StateAnnotation = Annotation.Root({
  errors: Annotation<string[]>({
    reducer: (prev, next) => next, // ✅ Replace with new errors
  }),
});
```

---

### ❌ Pitfall 4: Forgetting thread_id on Resume

```typescript
// ❌ WRONG - different thread_id
await graph.invoke({ ... }, { thread_id: "thread_1" }); // Initial
// ... interrupt ...
await graph.invoke(
  new Command({ resume: "answer" }),
  { thread_id: "thread_2" } // ❌ Different thread_id!
);
```

**✅ Correct**: Use SAME thread_id for resume.

```typescript
const threadId = "thread_1";
await graph.invoke({ ... }, { configurable: { thread_id: threadId } });
// ... interrupt ...
await graph.invoke(
  new Command({ resume: "answer" }),
  { configurable: { thread_id: threadId } } // ✅ SAME thread_id
);
```

---

### ❌ Pitfall 5: Return Plain Object Instead of Command

```typescript
// ❌ WRONG - plain object
async function myNode(state: State) {
  return {
    field: "value"
  };
}
```

**✅ Correct**: Always use Command.

```typescript
async function myNode(state: State) {
  return new Command({
    update: {
      field: "value"
    }
  });
}
```

---

## Summary: Key Takeaways

1. ✅ **Interrupt Pattern**: Node re-executes after resume, check `state.resumeValue` at beginning
2. ✅ **Command Pattern**: Always use `Command({update, goto})`, never plain object
3. ✅ **Reducers**: CONCAT for arrays (messages), MERGE for objects (extractedContext), REPLACE for errors
4. ✅ **Redis Checkpointer**: One client per app, TTL automatic, thread_id per workflow instance
5. ✅ **Resume**: Use `Command({resume: value})` with SAME thread_id
6. ✅ **Dynamic Routing**: Use `Command({goto})` for flexible routing with state updates
7. ❌ **Never**: Try/catch around interrupt, forget checkpointer, use wrong reducer, different thread_id on resume

---

## References

- [LangGraph.js Docs](https://langchain-ai.github.io/langgraphjs/)
- [WayMates architecture.md](../../../docs/architecture/workflows/facade/features-5-7-architecture.md)
- [langgraph_rules.md](../../../langgraph_rules.md) (Python, but concepts apply)
- [Context7 LangGraph Examples](https://context7.com/langchain-ai/langgraphjs)

---

**Maintainers**: Architecture Team
**Last Updated**: 2025-11-14
**Next Review**: After Data Ingestion Workflow implementation
