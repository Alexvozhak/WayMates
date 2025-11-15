---
description: "Проработка фичи: PENDING → READY_FOR_WORK (Type Schema, Architecture, Impl Plan, Test Plan)"
allowed-tools: ["Read", "Edit", "Task", "AskUserQuestion"]
argument-hint: "[feature_id]"
---

# 🎯 Plan Feature (Implementation Planning)

$ARGUMENTS

## Цель

Проработать фичу из PENDING состояния в READY_FOR_WORK:
- Design Type Schema через planner agent
- Определить Architecture Decisions
- Составить Implementation Plan
- Сформировать Test Plan
- Определить Context to Study
- Insights и Guidelines (DO/DON'T)
- DoD и Impact Assessment

**Key Principle**: Type-First Development - проектируем типы и интерфейсы ДО coding.

---

## Workflow

### Phase 1: Load and Validate

1. **Read** `memory-bank/knowledge/features-registry.md`
2. **Find** feature by ID (from $ARGUMENTS or interactive selection via AskUserQuestion)
3. **Validate status**:
   - If status = PENDING → continue
   - If status = READY_FOR_WORK → "Feature already planned. Use /implement-feature to code."
   - If status = DONE → "Feature already implemented. Check registry."

4. **Read** task file `tasks/features/FEAT-XXX.md` (PENDING state with User Story + AS IS + TO BE)

---

### Phase 2: Call planner Agent (Type Schema + Architecture)

**Mandatory**: Call `planner` sub-agent for Type Schema design.

**Prompt for planner**:
```
Feature: [Title from FEAT-XXX.md]

User Story: [from task file]
AS IS: [from task file]
TO BE: [from task file]

Task: Design Type Schema and Architecture for this feature.

Required deliverables:
1. TYPE SCHEMA (public API, internal state, component interfaces)
2. Architecture Decisions (which components affected, how they interact)
3. Technology choices (if applicable - libraries, patterns)

Focus: Production-ready types for immediate implementation, not exploratory design.
```

**planner agent provides**:
- Type Schema (TypeScript interfaces, Zod schemas)
- Architecture Decisions (component interaction, dataflow)
- Technology recommendations (if needed)

**Store output** for inclusion in task file.

---

### Phase 3: Interactive Planning (gather remaining details)

**Use AskUserQuestion** to gather:

**3.1 Context to Study**

```
Question: "Какие файлы/документы изучить перед реализацией?"
Options (single select):
( ) Напишу сам через Other (список файлов с path:lines, документы в .claude/, memory-bank/)
( ) Использовать рекомендации planner (если он предоставил список)
```

User provides list of files/docs to study before coding. Example:
```
- src/shared/schemas.ts (lines 150-250 - userContextSchema definition)
- src/core/persistence-query-builder.ts (SET properties pattern)
- src/cypher/queries/search.ts (map projection examples)
- .claude/routers/cypher/cypher-rules.md (null safety, optional field handling)
- tests/helpers/test-data-manager.ts (test user creation pattern)
```

---

**3.2 Implementation Plan**

```
Question: "Implementation Plan - что нужно сделать (порядок шагов)?"
Options (single select):
( ) Напишу сам через Other (список шагов с порядком выполнения)
( ) Использовать план от planner (если достаточно детальный)
```

User provides step-by-step plan. Example:
```
1. Schema: Update userContextSchema with salary fields + validation
2. Persistence: Update buildPersistContextQuery() to SET salary properties (null-safe)
3. Search: Update buildSearchQuery() map projection to return salary fields
4. Optional: Add WHERE clause for salary filtering (defer to MVP decision)
5. Test Data: Create U17 (exact salary), U18 (range salary)
6. Tests: AC10 (exact), AC11 (range), AC12 (null handling)

Order: Schema → Persistence → Map Projection → Test Data → Tests
```

---

**3.3 Test Plan**

```
Question: "Test Plan - список тестов + бизнес-кейс (1 предложение на тест)?"
Options (single select):
( ) Напишу сам через Other (название теста + бизнес-кейс)
```

User provides test list with business case. Example:
```
1. AC10 (integration): U17 with salaryExact=100000 → search returns salary in results
   Business case: Display exact salary when provided

2. AC11 (integration): U18 with salaryMin=80000, salaryMax=120000 → range returned
   Business case: Display range when both provided

3. AC12 (integration): U1 (no salary) → null values in results
   Business case: Backward compatibility, null for missing

4. Schema validation (unit): salaryMin > salaryMax → validation error
   Business case: Prevent invalid data entry
```

---

**3.4 Insights & Guidelines**

```
Question: "Insights - специфичные инсайты для этой задачи (лаконично, кратко, ёмко)?"
Options (single select):
( ) Напишу сам через Other
( ) Пропустить

Question: "Guidelines - что ДЕЛАТЬ и что НЕ ДЕЛАТЬ при реализации?"
Options (single select):
( ) Напишу сам через Other (DO: ..., DON'T: ...)
( ) Использовать стандартные guidelines (schema change, Cypher rules, testing)
```

User provides specific insights and guidelines. Example:
```
Insights:
- Naming: Use salaryMin/salaryMax (not salaryFrom/salaryTo) for clarity
- Null handling: Neo4j returns null for missing properties in map projection → backward compatible
- Migration: No migration script needed (test DB recreated from scratch)
- Scope decision: Salary fields are DISPLAY ONLY (no filtering/scoring in MVP) - defer to Facade

Guidelines:
DO:
- Use map projection for RETURN: c { .salaryMin, .salaryMax }
- Add null safety to persistence: SET c.salaryMin = $salaryMin (Neo4j handles nulls)
- Follow schema validation pattern (Zod refine for min/max check)
- Create test data U17-U18 in Batch C (special cases)

DON'T:
- Add salary filtering logic in Cypher (defer to Facade)
- Create migration script (no production data)
- Skip validation (min > max is invalid)
- Forget map projection (common mistake!)
```

---

**3.5 DoD + Impact Assessment**

```
Question: "DoD - критерии готовности?"
Options (multiSelect):
[x] Schema updated with new fields + validation
[x] Persistence/Search queries updated
[x] Test data created
[x] Integration tests pass
[x] Lint + tsc clean
[x] reviewer agent validation
[x] qa agent validation

Question: "Impact Assessment - что затронуто?"
Options (multiSelect):
[x] Schema change (добавление полей в Neo4j)
[x] Breaking change (несовместимость с API)
[x] Migration required (нужен скрипт миграции)
[ ] Affected: Core managers
[ ] Affected: Facade MCP tools
[ ] New dependencies (какие библиотеки?)
```

User selects applicable items.

---

**3.6 Edge Cases & Risks**

```
Question: "Edge Cases & Risks - граничные случаи и риски?"
Options (single select):
( ) Напишу сам через Other (null values, boundaries, breaking changes, regressions)
( ) Пропустить (use standard risk assessment)
```

User provides edge cases and risks. Example:
```
Edge Cases:
- Both salaryMin and salaryMax null → null in results (backward compat)
- Only salaryMin provided → null salaryMax (partial data OK)
- salaryMin > salaryMax → validation error (Zod refine catches)
- Negative values → validation error (Zod .positive())

Risks:
- Breaking change if schema migration incorrect → test on fresh DB first
- Forgetting map projection → salary fields not returned (common mistake)
- Test data overlap with existing U1-U16 → use new U17-U18 (no conflicts)
```

---

### Phase 4: Update Task File

**Expand** `tasks/features/FEAT-XXX.md` with gathered information:

Add sections (keeping original User Story + AS IS + TO BE):

```markdown
---

## Context to Study

**Перед реализацией изучить:**
[files/docs from Step 3.1]

---

## Type Schema

[from planner agent - Step 2]

---

## Architecture Decisions

[from planner agent - Step 2]

---

## Implementation Plan

[from Step 3.2]

---

## Test Plan

[from Step 3.3]

---

## Insights

[from Step 3.4, if provided]

---

## Guidelines

**DO**:
[from Step 3.4]

**DON'T**:
[from Step 3.4]

---

## DoD (Definition of Done)

[checklist from Step 3.5]

---

## Impact Assessment

[from Step 3.5]

---

## Edge Cases & Risks

[from Step 3.6, if provided]
```

---

### Phase 5: Update Registry

**Edit** `memory-bank/knowledge/features-registry.md`:
- Find row with FEAT-XXX
- Change status: PENDING → READY_FOR_WORK

```markdown
| FEAT-XXX | 2025-11-15 | READY_FOR_WORK | [Title] | [Priority] | [Component] | [tasks/features/FEAT-XXX.md](../../tasks/features/FEAT-XXX.md) | [session] |
```

---

### Phase 6: Show Summary

```markdown
✅ Feature FEAT-XXX planning complete!

**Status**: PENDING → READY_FOR_WORK
**File**: tasks/features/FEAT-XXX.md (expanded with Type Schema, Impl Plan, Test Plan, Guidelines)
**Registry**: Updated to READY_FOR_WORK

**Added sections**:
- Context to Study ([N files/docs])
- Type Schema (from planner agent)
- Architecture Decisions (from planner agent)
- Implementation Plan ([N steps])
- Test Plan ([N tests])
- Insights (task-specific notes)
- Guidelines (DO/DON'T)
- DoD ([N criteria])
- Impact Assessment
- Edge Cases & Risks

**Next step**:
Run `/implement-feature FEAT-XXX` to code (Type Schema готов, planner не нужен)
```

---

### Phase 7: Offer TODO List

**Ask user**: Would you like to load Implementation Plan into TODO list?

Proposed tasks (from Implementation Plan):
```
- Step 1 from Implementation Plan
- Step 2 from Implementation Plan
- Step 3 from Implementation Plan
- ...
- Call cypher-expert (if Cypher queries needed)
- Call reviewer agent
- Call qa agent
- Run lint + tsc
- Run unit tests
- Run integration tests
- Update task file
- Update registry
```

If user agrees → call TodoWrite:
```typescript
TodoWrite({
  todos: [
    { content: "[Step 1 from Implementation Plan]", status: "pending", activeForm: "[Step 1 in gerund]" },
    { content: "[Step 2 from Implementation Plan]", status: "pending", activeForm: "[Step 2 in gerund]" },
    // ... all steps from plan
    { content: "Call cypher-expert agent (if needed)", status: "pending", activeForm: "Calling cypher-expert" },
    { content: "Call reviewer agent", status: "pending", activeForm: "Calling reviewer agent" },
    { content: "Call qa agent", status: "pending", activeForm: "Calling qa agent" },
    { content: "Run quality checks (lint + tsc)", status: "pending", activeForm: "Running quality checks" },
    { content: "Run unit tests", status: "pending", activeForm: "Running unit tests" },
    { content: "Run integration tests", status: "pending", activeForm: "Running integration tests" },
    { content: "Update task file (Implementation Notes)", status: "pending", activeForm: "Updating task file" },
    { content: "Update registry (READY_FOR_WORK → DONE)", status: "pending", activeForm: "Updating registry" }
  ]
})
```

---

## Important Notes

1. **Status validation**: MUST be PENDING to run /plan-feature
2. **planner agent MANDATORY**: Type Schema - основа реализации
3. **NO full architecture design**: Это НЕ 10-фазная проработка (старый plan-feature.md), фокус на Implementation Readiness
4. **Type-First**: planner даёт Type Schema → реализация строго по нему
5. **File preservation**: Keep original User Story + AS IS + TO BE sections
6. **Detailed planning**: More detail now = faster implementation later

---

## Difference from Old /plan-feature

| Aspect | Old plan-feature.md | New plan-feature.md |
|--------|---------------------|---------------------|
| Goal | Full architecture design (10 phases) | Implementation readiness (Type Schema + Plan) |
| Output | docs/architecture/*.md (architecture spec) | tasks/features/FEAT-XXX.md (expanded) |
| Phases | 10 (Problem Analysis, Alternatives, Scenarios, Dataflow, etc.) | 6 (Load, planner, Interactive, Update File, Update Registry, Summary) |
| planner usage | Optional (Phase 2) | Mandatory (Phase 2, Type Schema required) |
| Status change | No status change | PENDING → READY_FOR_WORK |
| Use case | Complex features needing architectural exploration | All features (MVP-ready planning) |

**Old plan-feature.md**: For architectural exploration (new patterns, complex systems, design decisions)
**New plan-feature.md**: For implementation planning (Type Schema, step-by-step plan, ready to code)

---

## Example Execution

```
User: /plan-feature FEAT-001

Phase 1: Load and Validate
→ Read features-registry.md
→ Found FEAT-001, status = PENDING ✓
→ Read tasks/features/FEAT-001.md (User Story, AS IS, TO BE)

Phase 2: Call planner Agent
→ Task tool with subagent_type=planner
→ Prompt: "Design Type Schema for Add salary range to Context schema"
→ planner returns:
  - Type Schema (userContextSchema with salaryMin/salaryMax + Zod validation)
  - Architecture Decisions (persistence, search, map projection)

Phase 3: Interactive Planning
→ AskUserQuestion: Context to Study?
  User: "src/shared/schemas.ts, src/core/persistence-query-builder.ts, ..."

→ AskUserQuestion: Implementation Plan?
  User: "1. Schema, 2. Persistence, 3. Map Projection, 4. Test Data, 5. Tests"

→ AskUserQuestion: Test Plan?
  User: "AC10: exact salary, AC11: range, AC12: null, Schema validation"

→ AskUserQuestion: Insights?
  User: "Naming: salaryMin/salaryMax, No migration needed, Display only (no filtering)"

→ AskUserQuestion: Guidelines?
  User: "DO: map projection, null safety, validation. DON'T: filtering logic, migration, skip validation"

→ AskUserQuestion: DoD?
  User: Selects all criteria

→ AskUserQuestion: Impact Assessment?
  User: Schema change, no breaking change, no migration

→ AskUserQuestion: Edge Cases?
  User: "Both null, partial data, min > max, negative values"

Phase 4: Update Task File
→ Edit tasks/features/FEAT-001.md (add 10 sections: Context to Study, Type Schema, Architecture, Impl Plan, Test Plan, Insights, Guidelines, DoD, Impact, Edge Cases)

Phase 5: Update Registry
→ Edit features-registry.md (PENDING → READY_FOR_WORK)

Phase 6: Show Summary
→ "✅ Feature FEAT-001 planning complete. Run /implement-feature FEAT-001 to code."

Phase 7: Offer TODO List
→ Ask: "Load Implementation Plan into TODO list?"
→ If yes → TodoWrite with steps from Implementation Plan + quality gates
```

---

## Next Steps After Planning

- Use `/implement-feature FEAT-XXX` to implement (will load Type Schema from task file, planner NOT called again)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "plan: Feature FEAT-XXX Type Schema complete"`
2. Run /sync-memory to update Memory Bank?
