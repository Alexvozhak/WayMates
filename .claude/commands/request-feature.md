---
description: Add new feature request to features registry with structured template
---

# Request Feature Command

**Purpose**: Add a new feature to `memory-bank/knowledge/features-registry.md` with structured information.

---

## Workflow

1. **Gather information** using `AskUserQuestion` tool:
   - Feature title (short, descriptive)
   - Affected component/module
   - Priority (P0/P1/P2)
   - Motivation (why needed)
   - User story (optional)
   - Acceptance Criteria (list of checkboxes)
   - Impact assessment (schema changes, breaking changes, migration)

2. **Read** `features-registry.md` to get next Feature ID

3. **Add feature** to "Pending Features" table and detailed section

4. **Show summary** to user with Feature ID

---

## Template to Use

```markdown
### Feature #N: [Title]
**Component**: [component]
**Date**: [today's date]
**Status**: TODO
**Priority**: [🔴 P0 / 🟡 P1 / 🟢 P2]

**Motivation**:
[Why this feature is needed]

**User Story**:
[Optional: As a X, I want Y, so that Z]

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] Tests cover [scenarios]
- [ ] Documentation updated (if applicable)

**Impact Assessment**:
- Schema change: YES/NO ([details])
- Breaking change: YES/NO
- Requires migration: YES/NO
- Affected components: [list]
```

---

## Priority Guidelines

- **🔴 P0 (Critical)**: Blocking production, security issue, data corruption risk
- **🟡 P1 (Important)**: High business value, user requested, improves UX significantly
- **🟢 P2 (Nice-to-have)**: Enhancement, optimization, quality-of-life improvement

---

## Example

```markdown
### Feature #1: Add salary range to Context schema
**Component**: Context schema, search-query-builder, migrations
**Date**: 2025-11-12
**Status**: TODO
**Priority**: 🟡 P1

**Motivation**:
Users need to filter career contexts by salary expectations to find realistic transition paths. Currently, salary information is not captured, limiting search relevance.

**User Story**:
As a user searching for career paths, I want to filter by salary range, so that I only see opportunities matching my financial expectations.

**Acceptance Criteria**:
- [ ] Context node has `salary_min` and `salary_max` properties (numeric, nullable)
- [ ] Migration script adds properties to existing contexts
- [ ] Search query builder supports salary range filtering (min/max parameters)
- [ ] Null salary values handled gracefully (excluded from range filters)
- [ ] Integration tests cover salary filtering edge cases
- [ ] Schema documentation updated

**Impact Assessment**:
- Schema change: YES (adds `salary_min`, `salary_max` to Context node)
- Breaking change: NO (optional fields, backward compatible)
- Requires migration: YES (ALTER existing Context nodes)
- Affected components: Context schema, search-query-builder, migrations, tests
```

---

## Important Notes

1. **Use `AskUserQuestion` tool** to gather information interactively
2. **Auto-assign Feature ID** by reading the registry and finding the next number
3. **Format consistently** with the template above
4. **Show summary** after adding feature for user confirmation
5. **Don't implement** - this command only adds to registry. Use `/implement-feature` to start work.
