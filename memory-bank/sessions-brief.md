# Sessions Brief

Краткая навигация по сессиям разработки. Детали в Memory MCP и docs/.

---

## 2025-11-15: Add languages B2+ support to Context (FEAT-018) ✅
Commit: 7effe23, bdb18e1 | Problem: Need language filtering for career search (B2+ proficiency) | Solution: Added languages field (ISO 639-1), adhoc/target search modes, SPEAKS_FLUENT relationships, fixed critical WITH clause bug | Result: 7 integration tests (SC1-7, TG-LANG-1/2), ESLint config + docs updated
Key Insight: WITH clause variable propagation - must explicitly list ALL variables in each WITH to avoid losing them (languages declared on line 91 but never extracted from $ctx on line 58)
См. MCP: Session 2025-11-15-languages, Pattern "WITH Clause Variable Propagation"

## 2025-11-15: Add salary fields to Context schema ✅
Commit: f0976a5 | Problem: Need salary data for career transition analysis | Solution: Added salaryExact/Min/Max with mutual exclusion, display-only (no filtering) | Result: 46/47 integration tests passing, AC10-AC12 added
Key Insight: Zod .refine() breaks .omit()/.partial() → export base schema without refinement for derivative operations
См. MCP: Session 2025-11-15, Pattern "Zod Base Schema Pattern"
