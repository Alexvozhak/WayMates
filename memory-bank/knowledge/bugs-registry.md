# Bugs Registry (Реестр багов)

Production bugs and design flaws discovered in the codebase.

**Priority levels:**
- 🔴 P0: Blocking, affects correctness
- 🟡 P1: Important, affects maintainability/UX
- 🟢 P2: Nice to have, minor issues

---

## Registry

| ID | Date | Component | Issue | Status | Priority |
|----|------|-----------|-------|--------|----------|
| - | - | - | No active bugs | - | - |

---

## Resolved Bugs (Archive)

Brief history of resolved bugs. Full details in `memory-bank/knowledge/decisions.md` and Memory MCP.

### #1: Skills Penalty When Skills Excluded ✅ RESOLVED
- **Discovered**: 2025-11-11 (AC2 integration test)
- **Resolved**: 2025-11-11 (commit d1da036)
- **Solution**: Skills NEVER in WHERE clause, penalty-based scoring with DB queries
- **См.**: `knowledge/decisions.md#Skills Never in WHERE Clause`, Memory MCP `Skills Scoring Architecture Decision 2025-11-11`

---

*Use `/report-bug` to add new bugs to this registry*
