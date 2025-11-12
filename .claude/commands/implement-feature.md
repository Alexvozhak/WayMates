---
description: Implement feature from registry with planner → cypher-expert → reviewer → qa workflow
---

# Implement Feature Command

**Purpose**: Select a feature from the registry and implement it with full quality gates.

---

## Workflow

### Phase 1: Feature Selection

1. **Read** `memory-bank/knowledge/features-registry.md`
2. **Parse** TODO and IN_PROGRESS features
3. **Show interactive selection** using `AskUserQuestion`:
   - List all TODO features with title, component, priority
   - User selects feature to implement
4. **Update status** to IN_PROGRESS in registry

### Phase 2: Planning & Architecture (MANDATORY)

5. **Call `planner` agent** with feature requirements:
   - Provide full feature description from registry
   - Request TYPE SCHEMA design
   - Request architecture decisions
   - Request technology choices (if applicable)

6. **Review planner output** with user (if complex):
   - Show type schema
   - Highlight architectural decisions
   - Confirm approach before coding

### Phase 3: Implementation

7. **If Cypher queries needed**: Call `cypher-expert` agent
   - Provide query requirements from planner
   - Get tested queries via MCP neo4j-cypher
   - Get performance analysis

8. **Implement feature** according to type schema:
   - Follow planner's type contracts STRICTLY
   - Use cypher-expert's tested queries
   - Keep functions simple (max-depth: 2, complexity: 8)

9. **Update Acceptance Criteria** checkboxes in registry as you complete sub-tasks

### Phase 4: Quality Gates (MANDATORY)

10. **Call `reviewer` agent** (automatically after code):
    - Check for bugs, edge cases
    - Verify DRY violations
    - Ensure type schema compliance

11. **Fix critical issues** from reviewer

12. **Call `qa` agent** (automatically after reviewer):
    - Analyze test coverage
    - Check test quality
    - Verify integration tests (if schema/Cypher changed)

13. **Run quality checks**:
    ```bash
    npm run lint          # MANDATORY
    npx tsc --noEmit      # MANDATORY
    npm run test:unit     # If logic changed
    npm run test:integration  # If schema/Cypher changed
    ```

14. **Fix ALL errors** before proceeding

### Phase 5: Completion

15. **Update feature in registry**:
    - Set status to DONE
    - Add commit hash (if committed)
    - Add implementation notes:
      - Type schema design decisions
      - New/modified Cypher queries
      - Test coverage summary

16. **Show completion summary**:
    - Feature ID and title
    - What was implemented
    - Test coverage
    - Commit hash (if applicable)

---

## Feature Selection Format

When showing features for selection, use `AskUserQuestion`:

```typescript
{
  question: "Which feature do you want to implement?",
  header: "Select feature",
  multiSelect: false,
  options: [
    {
      label: "#1: Salary range in Context",
      description: "🟡 P1 | Component: Context schema, search | Impact: Schema change + migration"
    },
    {
      label: "#2: Education level property",
      description: "🟡 P1 | Component: Context schema | Impact: Schema change"
    }
  ]
}
```

---

## Quality Gates Checklist

Before marking feature as DONE:

- [ ] ✅ **planner** called for type schema + architecture
- [ ] ✅ **cypher-expert** called (if Cypher queries involved)
- [ ] ✅ **Implemented** according to type schema
- [ ] ✅ **reviewer** called and critical issues fixed
- [ ] ✅ **qa** called and test coverage verified
- [ ] ✅ `npm run lint` passed
- [ ] ✅ `npx tsc --noEmit` passed
- [ ] ✅ Tests passed (unit + integration if applicable)
- [ ] ✅ All ACs checked off in registry
- [ ] ✅ Status updated to DONE with commit hash

---

## Example: IN_PROGRESS → DONE Update

**Before**:
```markdown
| #1 | 2025-11-12 | Context schema | Salary range (min/max) | IN_PROGRESS | 🟡 P1 |

### Feature #1: Add salary range to Context schema
**Status**: IN_PROGRESS
...
**Acceptance Criteria**:
- [ ] Context node has `salary_min` and `salary_max` properties
- [ ] Migration script adds properties
- [ ] Search query supports salary filtering
- [ ] Tests cover edge cases
```

**After**:
```markdown
| #1 | 2025-11-12 | Context schema | Salary range (min/max) | DONE | 🟡 P1 |

### Feature #1: Add salary range to Context schema
**Status**: DONE
...
**Acceptance Criteria**:
- [x] Context node has `salary_min` and `salary_max` properties
- [x] Migration script adds properties
- [x] Search query supports salary filtering
- [x] Tests cover edge cases

**Implementation Notes**:
- Type schema: `SearchParams` extended with `salaryMin?`, `salaryMax?` (optional numbers)
- Cypher queries: Added WHERE clause `c.salary_min >= $salaryMin AND c.salary_max <= $salaryMax`
- Test coverage: 4 new integration tests for salary filtering (null values, range bounds, no results)

**Commit**: a1b2c3d
```

---

## Important Notes

1. **ALWAYS call planner first** - type schema is mandatory
2. **ALWAYS call cypher-expert** for Cypher queries - no exceptions
3. **ALWAYS call reviewer + qa** after implementation - quality gates
4. **Update ACs as you go** - check off sub-tasks during implementation
5. **Don't skip quality checks** - lint + tsc + tests before DONE
6. **Large features**: Break into sub-tasks in ACs, complete incrementally

---

## Difference from `/fix-bug`

| Aspect | `/fix-bug` | `/implement-feature` |
|--------|-----------|---------------------|
| Planning | Load context only | **Call planner** (type schema + architecture) |
| Cypher | Fix broken query | **Call cypher-expert** for new queries |
| Implementation | Fix code | Build new functionality from type schema |
| Scope | Narrow (fix bug) | Broad (design + implement) |

Both workflows share: reviewer + qa + quality gates
