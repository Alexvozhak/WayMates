# Features Registry

**Purpose**: Track feature requests and new functionality from initial request to completion.

**Workflow**:
1. Use `/request-feature` to add new feature
2. Use `/implement-feature` to start working (auto-sets IN_PROGRESS)
3. Complete implementation → `/implement-feature` auto-sets DONE
4. Use `/sync-memory` to archive completed features

---

## Pending Features

| # | Date | Component | Title | Status | Priority |
|---|------|-----------|-------|--------|----------|
| - | - | - | No pending features | - | - |

---

## Completed Features

| # | Date | Component | Title | Completed | Commit |
|---|------|-----------|-------|-----------|--------|
| - | - | - | No completed features yet | - | - |

---

## Feature Template

```markdown
### Feature #N: [Title]
**Component**: [affected component/module]
**Date**: YYYY-MM-DD
**Status**: TODO | IN_PROGRESS | DONE
**Priority**: 🔴 P0 (critical) | 🟡 P1 (important) | 🟢 P2 (nice-to-have)

**Motivation**:
Why this feature is needed (business value, user request, technical debt, etc.)

**User Story** (optional):
As a [user type], I want [goal], so that [benefit].

**Acceptance Criteria**:
- [ ] [Criterion 1 - can be a sub-task for large features]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] Tests cover [specific scenarios]
- [ ] Documentation updated (if applicable)

**Impact Assessment**:
- Schema change: YES/NO (describe changes)
- Breaking change: YES/NO
- Requires migration: YES/NO
- Affected components: [list]

**Implementation Notes** (added during `/implement-feature`):
- Type schema: [link to planner output or commit]
- Cypher queries: [new/modified queries]
- Test coverage: [summary]

**Commit**: [commit hash after completion]
```
