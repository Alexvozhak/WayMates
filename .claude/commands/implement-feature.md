---
description: "Реализовать фичу с проверкой статуса + использование task file (без planner)"
allowed-tools: ["Read", "Edit", "Write", "Task", "AskUserQuestion", "Bash", "TodoWrite"]
argument-hint: "[optional: feature_id]"
---

# 🚀 Implement Feature (Task-Based Execution)

$ARGUMENTS

## Цель

Реализовать фичу из состояния READY_FOR_WORK в DONE, используя подготовленный план из task file.

**Key Principle**: Task file уже содержит Type Schema, Implementation Plan, Test Plan. Planner НЕ нужен.

---

## Workflow

### Phase 1: Load Feature and Validate

1. **Read** `memory-bank/knowledge/features-registry.md`
2. **Find feature** by ID (from $ARGUMENTS or interactive selection)
3. **Validate status**:
   - If status = PENDING → "Feature not planned. Run /plan-feature first."
   - If status = READY_FOR_WORK → continue ✓
   - If status = IN_PROGRESS → "Feature already in progress. Continue or reset?"
   - If status = DONE → "Feature completed. Check registry."

4. **Update status** to IN_PROGRESS in registry
5. **Read task file** `tasks/features/FEAT-XXX.md` (contains all planning artifacts)

---

### Phase 2: Load Context (Interactive Decisions)

**Use ONE AskUserQuestion call** with strategic questions:

```typescript
AskUserQuestion({
  questions: [
    {
      question: "Загрузить Implementation Plan в TODO list?",
      header: "TODO setup",
      multiSelect: false,
      options: [
        { label: "Да, создать TODO из плана", description: "Шаги из Implementation Plan станут задачами" },
        { label: "Нет, работать без TODO", description: "Прямая реализация без отслеживания" }
      ]
    },
    {
      question: "Какой режим review использовать?",
      header: "Review mode",
      multiSelect: false,
      options: [
        { label: "Full review", description: "reviewer + qa agents после каждого компонента" },
        { label: "Final review", description: "reviewer + qa только в конце" },
        { label: "Skip review", description: "Только lint + tsc (быстрая итерация)" }
      ]
    },
    {
      question: "Как обрабатывать test failures?",
      header: "Test strategy",
      multiSelect: false,
      options: [
        { label: "Fix immediately", description: "Исправить сломанные тесты сразу" },
        { label: "Track and fix later", description: "Записать в TODO, продолжить" },
        { label: "Skip tests", description: "Только lint + tsc (нет DB)" }
      ]
    }
  ]
})
```

**Store user preferences** for the session.

---

### Phase 3: Pre-Implementation Context Study

**Read "Context to Study"** from task file and load specified files:

```typescript
// From task file Context to Study section:
// - src/shared/schemas.ts:150-250
// - src/core/persistence-query-builder.ts (SET pattern)
// - .claude/routers/cypher/cypher-rules.md

// Auto-load these files BEFORE starting implementation
Read({ file_path: "src/shared/schemas.ts", offset: 150, limit: 100 })
Read({ file_path: "src/core/persistence-query-builder.ts" })
Read({ file_path: ".claude/routers/cypher/cypher-rules.md" })
```

**Show brief summary** of loaded context (1-2 lines per file).

---

### Phase 4: Implementation Execution

**If user chose TODO list** (from Phase 2):

```typescript
TodoWrite({
  todos: [
    // Convert Implementation Plan steps to todos
    { content: "[Step 1 from plan]", status: "pending", activeForm: "Working on [step 1]" },
    { content: "[Step 2 from plan]", status: "pending", activeForm: "Working on [step 2]" },
    // ... all steps
    { content: "Run quality checks", status: "pending", activeForm: "Running quality checks" },
    { content: "Update registry to DONE", status: "pending", activeForm: "Updating registry" }
  ]
})
```

**Execute Implementation Plan** step by step:
1. Mark current step as `in_progress` in TODO
2. Implement according to Type Schema from task file
3. Follow Guidelines (DO/DON'T) from task file
4. Mark step as `completed`
5. Move to next step

**Critical decision points** (use AskUserQuestion only for these):

```typescript
// ONLY if encountering ambiguity not covered in plan
if (ambiguousImplementationChoice) {
  AskUserQuestion({
    questions: [{
      question: "План не покрывает этот случай. Как поступить?",
      header: "Edge case",
      multiSelect: false,
      options: [
        { label: "Вариант A", description: "[specific approach A]" },
        { label: "Вариант B", description: "[specific approach B]" },
        { label: "Skip for now", description: "Добавить TODO, продолжить" }
      ]
    }]
  })
}
```

---

### Phase 5: Quality Gates (Based on User Preference)

**If review_mode = "Full review"**:
```typescript
// After each major component
Task({ subagent_type: "reviewer", prompt: "Review [component]" })
// Fix critical issues
Task({ subagent_type: "qa", prompt: "Check test coverage for [component]" })
```

**If review_mode = "Final review"**:
```typescript
// Only after all implementation done
Task({ subagent_type: "reviewer", prompt: "Review full implementation" })
Task({ subagent_type: "qa", prompt: "Check overall test coverage" })
```

**Always run** (unless user chose skip):
```bash
npm run lint
npx tsc --noEmit
```

**Handle test failures** based on user preference:
- "Fix immediately" → Stop and fix
- "Track and fix later" → Add to TODO, continue
- "Skip tests" → Don't run tests

---

### Phase 6: Cypher Queries (Conditional)

**ONLY if Implementation Plan mentions Cypher changes**:

```typescript
// Check if task file contains Cypher-related steps
if (taskFile.includes("Cypher") || taskFile.includes("query")) {
  AskUserQuestion({
    questions: [{
      question: "Обнаружены Cypher-изменения. Вызвать cypher-expert?",
      header: "Cypher expert",
      multiSelect: false,
      options: [
        { label: "Да, проверить queries", description: "cypher-expert проверит через MCP" },
        { label: "Нет, queries уже готовы", description: "В task file есть готовые queries" },
        { label: "Позже при необходимости", description: "Вызову если возникнут проблемы" }
      ]
    }]
  })

  if (userChoice === "yes") {
    Task({
      subagent_type: "cypher-expert",
      prompt: "Validate and optimize queries from Implementation Plan: [queries]"
    })
  }
}
```

---

### Phase 7: Completion

1. **Run final quality checks**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run test:integration  # if not skipped
   ```

2. **Update task file** with Implementation Notes:
   ```markdown
   ## Implementation Notes

   - Completed: [date]
   - Deviations from plan: [if any]
   - Issues encountered: [list]
   - Performance notes: [if applicable]
   ```

3. **Update registry**:
   - Status: IN_PROGRESS → DONE
   - Add commit hash (if committed)
   - Add brief implementation summary

4. **Offer git commit**:
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "Создать git commit?",
       header: "Git commit",
       multiSelect: false,
       options: [
         { label: "Да, commit сейчас", description: "git add + commit с message" },
         { label: "Нет, позже", description: "Оставить изменения unstaged" }
       ]
     }]
   })
   ```

5. **Show summary**:
   ```markdown
   ✅ Feature FEAT-XXX implementation complete!

   **Status**: READY_FOR_WORK → DONE
   **Review mode**: [user's choice]
   **Quality gates**: ✓ lint, ✓ tsc, [✓/✗] tests
   **Commit**: [hash or "not committed"]

   **Next steps**:
   - Run `/sync-memory` to update Memory Bank
   - Review implementation notes in task file
   ```

---

## Strategic AskUserQuestion Usage

### When TO Ask (Good Balance)

1. **Initial preferences** (Phase 2) - TODO setup, review mode, test strategy
2. **Ambiguous edge cases** not covered in plan
3. **Cypher changes** detection (auto-detect, ask once)
4. **Final commit** decision
5. **Unexpected blockers** (missing dependency, API change)

### When NOT to Ask (Avoid Interruptions)

1. **Steps clearly defined** in Implementation Plan → just execute
2. **Guidelines present** in task file → follow them
3. **Type Schema defined** → implement strictly per schema
4. **Test Plan specified** → create tests per plan
5. **DoD criteria clear** → check them without asking
6. **Insights documented** → apply them silently
7. **Minor decisions** (variable names, file organization) → use best judgment
8. **Error handling** covered in Edge Cases → implement as specified

---

## Important Principles

1. **Trust the plan**: Task file from `/plan-feature` is authoritative
2. **No planner call**: Type Schema already exists in task file
3. **Batch questions**: Use ONE AskUserQuestion with multiple questions
4. **Respect preferences**: Store and apply throughout session
5. **Progressive disclosure**: Don't ask about Cypher if no Cypher in plan
6. **Smart defaults**: If user skips question → use sensible default
7. **Context-aware**: Load "Context to Study" files BEFORE starting

---

## Difference from Old /implement-feature

| Aspect | Old (from planner) | New (from task file) |
|--------|-------------------|---------------------|
| Source | Call planner for Type Schema | Read from task file |
| Planning | Generate during implementation | Already in READY_FOR_WORK |
| Questions | Many ad-hoc questions | Strategic upfront + edge cases |
| Context | Discover as needed | Pre-loaded from "Context to Study" |
| Review | Always full | User chooses mode |
| Tests | Always run | User chooses strategy |
| TODO | Optional/manual | Automated from Implementation Plan |

---

## Error Recovery

If implementation gets stuck:

```typescript
AskUserQuestion({
  questions: [{
    question: "Реализация заблокирована. Как proceed?",
    header: "Blocked",
    multiSelect: false,
    options: [
      { label: "Call planner for help", description: "Получить архитектурную помощь" },
      { label: "Skip this step", description: "Добавить TODO, продолжить" },
      { label: "Abort and reset", description: "Вернуть статус READY_FOR_WORK" }
    ]
  }]
})
```

---

## Example Execution

```
User: /implement-feature FEAT-001

Phase 1: Load and Validate
→ Read registry, find FEAT-001
→ Status = READY_FOR_WORK ✓
→ Update to IN_PROGRESS
→ Read tasks/features/FEAT-001.md

Phase 2: Preferences (ONE AskUserQuestion)
→ TODO setup? Yes
→ Review mode? Final review
→ Test strategy? Fix immediately

Phase 3: Context Study
→ Auto-load: schemas.ts:150-250, persistence-query-builder.ts, cypher-rules.md
→ "Loaded 3 context files: schemas, persistence patterns, Cypher conventions"

Phase 4: Implementation
→ TodoWrite with 5 steps from Implementation Plan
→ Step 1: Update schema (in_progress) → implement → completed ✓
→ Step 2: Update persistence (in_progress) → implement → completed ✓
→ Step 3: Update map projection (in_progress) → implement → completed ✓
→ Step 4: Create test data (in_progress) → implement → completed ✓
→ Step 5: Write tests (in_progress) → implement → completed ✓

Phase 5: Quality Gates (Final review mode)
→ Task(reviewer) → 2 issues found → fixed
→ Task(qa) → coverage adequate
→ npm run lint → passed
→ npx tsc --noEmit → passed

Phase 6: Cypher (detected)
→ Ask: "Call cypher-expert?" → Yes
→ Task(cypher-expert) → queries validated

Phase 7: Completion
→ npm run test:integration → passed
→ Update task file with Implementation Notes
→ Update registry → DONE
→ Ask: "Create commit?" → Yes
→ git commit → hash: abc123

Summary displayed
```
