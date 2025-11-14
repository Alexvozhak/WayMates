# LangGraph Knowledge Router

**Purpose**: Guide для работы с LangGraph workflows в TypeScript.

---

## When to Load

**CRITICAL**: Load [langgraph-guide.md](langgraph-guide.md) BEFORE any LangGraph work:

### Planning Phase
- ✅ Designing LangGraph workflow architecture
- ✅ Planning state management (State Annotation, reducers)
- ✅ Planning interrupt/resume flows
- ✅ Deciding checkpointer strategy (Redis/SQLite/Memory)

### Implementation Phase
- ✅ Writing LangGraph nodes
- ✅ Implementing interrupt patterns
- ✅ Setting up checkpointers (RedisSaver, SqliteSaver)
- ✅ Implementing Command-based routing
- ✅ Handling resume logic

### Debugging Phase
- ✅ Debugging interrupt/resume issues
- ✅ Fixing state update problems
- ✅ Investigating checkpointer errors
- ✅ Analyzing workflow execution flow

---

## What's Inside

[langgraph-guide.md](langgraph-guide.md) contains:

1. **Interrupt Pattern** ⚠️ CRITICAL
   - How interrupt() works (throws exception)
   - Node re-execution after resume
   - Correct patterns for handling resume values

2. **Command Pattern**
   - Always use `Command({update, goto})`
   - Never return plain objects

3. **State Annotation with Reducers**
   - CONCAT for arrays (messages)
   - MERGE for objects (extractedContext)
   - REPLACE for errors

4. **Redis Checkpointer**
   - One client per application
   - TTL automatic
   - Session management

5. **Resume Workflow**
   - Using `Command({resume: value})`
   - SAME thread_id requirement

6. **Conditional Edges vs Dynamic Routing**
   - Static conditional edges (router functions)
   - Dynamic routing with Command (preferred)

7. **Send Pattern for Parallel Execution**
   - Map-reduce workflows
   - Dynamic fanout

8. **Stream Modes for Progress Tracking**
   - `invoke` vs `stream`
   - Stream modes: updates, values, messages

9. **Common Pitfalls**
   - Try/catch around interrupt (NEVER!)
   - Forgetting checkpointer
   - Wrong reducer types
   - Different thread_id on resume
   - Returning plain objects instead of Command

---

## Quick Decision Tree

```
Are you working with LangGraph?
  ↓ YES
  ↓
Load langgraph-guide.md BEFORE coding
  ↓
Follow patterns from guide
  ↓
Verify:
  ✅ Using Command (NOT plain object)
  ✅ Correct reducer for each state field
  ✅ Checkpointer configured
  ✅ Interrupt pattern handles resume correctly
  ↓
Code confidently
```

---

## Common Questions

**Q: When to use RedisSaver vs SqliteSaver vs MemorySaver?**
A: See [Section 4: Checkpointer Comparison](langgraph-guide.md#checkpointer-comparison)
- RedisSaver: Production (distributed), TTL automatic
- SqliteSaver: Production (single node), persistent
- MemorySaver: **Tests only**, lost on restart

**Q: How to handle interrupt correctly?**
A: See [Section 1: Interrupt Pattern](langgraph-guide.md#1-interrupt-pattern-critical)
- Node re-executes from beginning after resume
- Check `state.resumeValue` at start of node
- NEVER try/catch around interrupt()

**Q: Should I use conditional edges or Command routing?**
A: See [Section 6: Conditional Edges vs Dynamic Routing](langgraph-guide.md#6-conditional-edges-vs-dynamic-routing)
- Prefer Command routing (update state AND route in one operation)
- Use conditional edges only for simple, static routing

**Q: What reducer type should I use?**
A: See [Section 3: State Annotation with Reducers](langgraph-guide.md#3-state-annotation-with-reducers)
- CONCAT: Arrays that accumulate (messages)
- MERGE: Objects that patch (extractedContext)
- REPLACE: Validation errors (new set each time)

---

## Error Prevention Checklist

Before implementing LangGraph workflow:

- [ ] ✅ Read [langgraph-guide.md](langgraph-guide.md)
- [ ] ✅ Understand interrupt re-execution behavior
- [ ] ✅ Plan State Annotation with correct reducers
- [ ] ✅ Choose checkpointer (RedisSaver for WayMates)
- [ ] ✅ Design resume handling pattern
- [ ] ✅ Use Command for all node returns

---

## After Work: Self-Reflection

Use `/reflect langgraph` to analyze:
- What LangGraph patterns worked well?
- What patterns caused issues?
- What was missing from guide?
- How to improve documentation?

---

**Maintainers**: Architecture Team
**Last Updated**: 2025-11-14
**Related**: [.claude/routers/router.md](../router.md)
