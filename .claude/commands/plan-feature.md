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

4. **Read** task file `tasks/features/FEAT-XXX.md` (PENDING state - minimal file)

---

### Phase 2: Call planner Agent (Type Schema + Architecture)

**Mandatory**: Call `planner` sub-agent for Type Schema design.

**Prompt for planner**:
```
Feature: [Title from FEAT-XXX.md]
Description: [from task file]
Priority: [from task file]

Task: Design Type Schema and Architecture for this feature.

Required deliverables:
1. TYPE SCHEMA (public API, internal state, component interfaces)
2. Architecture Decisions (which components affected, how they interact)
3. Technology choices (if applicable - libraries, patterns)
4. Suggested Context to Study (files/docs to read before coding)
5. Suggested Implementation Plan (step-by-step breakdown)

Focus: Production-ready types for immediate implementation, not exploratory design.
```

**planner agent provides**:
- Type Schema (TypeScript interfaces, Zod schemas)
- Architecture Decisions (component interaction, dataflow)
- Technology recommendations (if needed)
- Suggested files to study
- Suggested implementation steps

**Store output** for inclusion in task file.

---

### Phase 3: Interactive Planning (Batch Questions)

**Use TWO AskUserQuestion calls** for efficiency:

#### Batch 1: Core Planning (4 questions)

```typescript
AskUserQuestion({
  questions: [
    {
      question: "Context to Study - файлы/документы для изучения перед реализацией?",
      header: "Context",
      multiSelect: false,
      options: [
        {
          label: "Использовать список от planner",
          description: "Planner предложил релевантные файлы"
        },
        {
          label: "Дополнить список planner",
          description: "Добавить свои файлы к предложенным"
        },
        {
          label: "Написать свой список",
          description: "Полностью заменить рекомендации planner"
        }
      ]
    },
    {
      question: "Implementation Plan - порядок шагов реализации?",
      header: "Impl Plan",
      multiSelect: false,
      options: [
        {
          label: "Использовать план от planner",
          description: "Planner предложил шаги реализации"
        },
        {
          label: "Дополнить план planner",
          description: "Добавить свои шаги к предложенным"
        },
        {
          label: "Написать свой план",
          description: "Полностью заменить план planner"
        }
      ]
    },
    {
      question: "Test Plan - список тестов с бизнес-кейсами?",
      header: "Test Plan",
      multiSelect: false,
      options: [
        {
          label: "Минимальный (основные кейсы)",
          description: "Happy path + 1-2 edge case"
        },
        {
          label: "Расширенный (все edge cases)",
          description: "Полный набор тестов с граничными случаями"
        },
        {
          label: "Написать свой список",
          description: "Детальный Test Plan через Other"
        }
      ]
    },
    {
      question: "Guidelines - что ДЕЛАТЬ и что НЕ ДЕЛАТЬ при реализации?",
      header: "Guidelines",
      multiSelect: false,
      options: [
        {
          label: "Стандартные для типа фичи",
          description: "Schema/Cypher/Testing conventions"
        },
        {
          label: "Специфичные для задачи",
          description: "Напишу DO/DON'T через Other"
        },
        {
          label: "Пропустить",
          description: "Без guidelines"
        }
      ]
    }
  ]
})
```

**Process answers**:
- If "Использовать от planner" → copy from planner output
- If "Дополнить" → ask for additions via Other
- If "Написать свой" → ask for full input via Other

---

#### Batch 2: Quality & Risk (3 questions)

```typescript
AskUserQuestion({
  questions: [
    {
      question: "DoD (Definition of Done) - критерии готовности?",
      header: "DoD",
      multiSelect: true,
      options: [
        { label: "Schema updated", description: "Схемы обновлены + validation" },
        { label: "Queries updated", description: "Persistence/Search queries" },
        { label: "Test data created", description: "Тестовые данные добавлены" },
        { label: "Tests pass", description: "Unit + integration tests" },
        { label: "Lint + tsc clean", description: "Качественные проверки" },
        { label: "reviewer validated", description: "reviewer agent проверил" },
        { label: "qa validated", description: "qa agent проверил" }
      ]
    },
    {
      question: "Impact Assessment - что затронуто изменениями?",
      header: "Impact",
      multiSelect: true,
      options: [
        { label: "Schema change", description: "Изменение Neo4j схемы" },
        { label: "Breaking change", description: "Несовместимость с API" },
        { label: "Migration required", description: "Нужен скрипт миграции" },
        { label: "Core managers", description: "Затронуты core компоненты" },
        { label: "Facade MCP tools", description: "Затронут Facade слой" },
        { label: "New dependencies", description: "Новые библиотеки" }
      ]
    },
    {
      question: "Edge Cases & Risks - граничные случаи и риски?",
      header: "Edge Cases",
      multiSelect: false,
      options: [
        {
          label: "Стандартные (null, boundaries)",
          description: "Типовые edge cases для фичи"
        },
        {
          label: "Написать специфичные",
          description: "Детальный список через Other"
        },
        {
          label: "Пропустить",
          description: "Без списка edge cases"
        }
      ]
    }
  ]
})
```

---

### Phase 4: Generate Insights (Optional)

**If user selected "Специфичные Guidelines" or "Написать Edge Cases"**:

```typescript
// Ask for details via Other field in previous questions
// Or use one more AskUserQuestion if needed
```

Otherwise, auto-generate based on feature type:
- Schema change → map projection, null safety, migration checklist
- Cypher change → canonical names, bounded patterns, PROFILE
- Testing → business logic vs coverage theater, test quality standards

---

### Phase 5: Update Task File

**Expand** `tasks/features/FEAT-XXX.md` with gathered information:

```markdown
# [Original Title]

**Priority**: [Original Priority]

[Original Description]

---

## Context to Study

**Перед реализацией изучить:**
[files/docs from Phase 3 Batch 1]

---

## Type Schema

[from planner agent - Phase 2]

---

## Architecture Decisions

[from planner agent - Phase 2]

---

## Implementation Plan

[from Phase 3 Batch 1]

---

## Test Plan

[from Phase 3 Batch 1]

---

## Insights

[auto-generated or user-provided]

---

## Guidelines

**DO**:
[from Phase 3 Batch 1 or auto-generated]

**DON'T**:
[from Phase 3 Batch 1 or auto-generated]

---

## DoD (Definition of Done)

[checklist from Phase 3 Batch 2]

---

## Impact Assessment

[from Phase 3 Batch 2]

---

## Edge Cases & Risks

[from Phase 3 Batch 2 or auto-generated]
```

---

### Phase 6: Update Registry

**Edit** `memory-bank/knowledge/features-registry.md`:
- Find row with FEAT-XXX
- Change status: PENDING → READY_FOR_WORK
- Update Component column (from planner Architecture Decisions)

```markdown
| FEAT-XXX | 2025-11-15 | READY_FOR_WORK | [Title] | [Priority] | [Component from planner] | [tasks/features/FEAT-XXX.md](../../tasks/features/FEAT-XXX.md) | [session] |
```

---

### Phase 7: Show Summary

```markdown
✅ Feature FEAT-XXX planning complete!

**Status**: PENDING → READY_FOR_WORK
**Component**: [from planner]
**File**: tasks/features/FEAT-XXX.md (expanded with Type Schema, Impl Plan, Test Plan, Guidelines)
**Registry**: Updated to READY_FOR_WORK

**Added sections**:
- Context to Study ([N files/docs])
- Type Schema (from planner agent)
- Architecture Decisions (from planner agent)
- Implementation Plan ([N steps])
- Test Plan ([N tests])
- Insights ([auto-generated or user-provided])
- Guidelines (DO/DON'T)
- DoD ([N criteria])
- Impact Assessment ([N items])
- Edge Cases & Risks

**Next step**:
Run `/implement-feature FEAT-XXX` to code (Type Schema готов, planner не нужен)
```

---

### Phase 8: Offer TODO List (Optional)

```typescript
AskUserQuestion({
  questions: [{
    question: "Загрузить Implementation Plan в TODO list для отслеживания?",
    header: "TODO list",
    multiSelect: false,
    options: [
      { label: "Да, создать TODO", description: "Шаги из плана станут задачами" },
      { label: "Нет, не нужно", description: "Буду использовать позже в /implement-feature" }
    ]
  }]
})
```

If user agrees → call TodoWrite with steps from Implementation Plan.

---

## Strategic AskUserQuestion Usage

### Batching Strategy

1. **Batch 1 (Core Planning)**: Context, Impl Plan, Test Plan, Guidelines - тесно связаны, решаются вместе
2. **Batch 2 (Quality & Risk)**: DoD, Impact, Edge Cases - про качество и риски
3. **Batch 3 (Optional)**: TODO list preference - финальное решение

**Benefits**:
- 2-3 calls вместо 6-7
- Логическая группировка вопросов
- Пользователь видит полную картину в каждой группе
- Меньше переключений контекста

### Smart Defaults

- **Context to Study**: Использовать от planner по умолчанию
- **Implementation Plan**: Использовать от planner по умолчанию
- **Guidelines**: Auto-generate на основе типа фичи
- **Edge Cases**: Auto-generate стандартные (null, boundaries)
- **DoD**: Предвыбрать стандартные критерии
- **Impact**: Пользователь выбирает applicable items

---

## Important Notes

1. **Status validation**: MUST be PENDING to run /plan-feature
2. **planner agent MANDATORY**: Type Schema - основа реализации
3. **Batch questions**: 2-3 calls вместо 6-7 individual questions
4. **Smart defaults**: Prefer planner recommendations, auto-generate when reasonable
5. **Type-First**: planner даёт Type Schema → реализация строго по нему
6. **File preservation**: Keep original Title + Priority + Description
7. **Detailed planning**: More detail now = faster implementation later

---

## Difference from Old /plan-feature

| Aspect | Old plan-feature.md | New plan-feature.md |
|--------|---------------------|---------------------|
| Questions | 6-7 individual calls | 2-3 batched calls |
| Planner usage | Recommendations only | Recommendations + smart defaults |
| Guidelines | Always ask | Auto-generate or ask |
| Edge Cases | Always ask | Auto-generate or ask |
| Context source | Always ask | Prefer planner, allow override |

**Key improvement**: Fewer interruptions, smarter defaults, better UX.

---

## Example Execution

```
User: /plan-feature FEAT-001

Phase 1: Load and Validate
→ Read features-registry.md
→ Found FEAT-001, status = PENDING ✓
→ Read tasks/features/FEAT-001.md (minimal: title, priority, description)

Phase 2: Call planner Agent
→ Task tool with subagent_type=planner
→ Prompt: "Design Type Schema for Add salary range to Context schema"
→ planner returns:
  - Type Schema (userContextSchema with salaryMin/salaryMax + Zod validation)
  - Architecture Decisions (persistence, search, map projection)
  - Suggested Context: schemas.ts, persistence-query-builder.ts, cypher-rules.md
  - Suggested Plan: 1. Schema, 2. Persistence, 3. Map Projection, 4. Test Data, 5. Tests

Phase 3: Interactive Planning (Batch 1 - ONE call)
→ Context to Study? "Использовать список от planner"
→ Implementation Plan? "Использовать план от planner"
→ Test Plan? "Расширенный (все edge cases)"
→ Guidelines? "Специфичные для задачи" → asks for DO/DON'T via Other

Phase 3: Interactive Planning (Batch 2 - ONE call)
→ DoD? User selects: Schema, Queries, Tests, Lint, reviewer, qa
→ Impact? User selects: Schema change (no breaking change, no migration)
→ Edge Cases? "Написать специфичные" → provides list via Other

Phase 4: Generate Insights
→ Auto-generate based on schema change pattern

Phase 5: Update Task File
→ Edit tasks/features/FEAT-001.md (add 10 sections)

Phase 6: Update Registry
→ Edit features-registry.md (PENDING → READY_FOR_WORK, Component: context-schema)

Phase 7: Show Summary
→ "✅ Feature FEAT-001 planning complete. Run /implement-feature FEAT-001 to code."

Phase 8: Offer TODO List
→ Ask: "Load Implementation Plan into TODO list?" → User: "Нет, позже"
```

---

## Next Steps After Planning

- Use `/implement-feature FEAT-XXX` to implement (will load Type Schema from task file, planner NOT called again)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "plan: Feature FEAT-XXX Type Schema complete"`
2. Run /sync-memory to update Memory Bank?
