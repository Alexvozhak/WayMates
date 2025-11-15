# Sessions Brief

Краткая навигация по сессиям разработки. Детали в Memory MCP и docs/.

---

## 2025-11-15: Add salary fields to Context schema ✅
Commit: f0976a5 | Problem: Need salary data for career transition analysis | Solution: Added salaryExact/Min/Max with mutual exclusion, display-only (no filtering) | Result: 46/47 integration tests passing, AC10-AC12 added
Key Insight: Zod .refine() breaks .omit()/.partial() → export base schema without refinement for derivative operations
См. MCP: Session 2025-11-15, Pattern "Zod Base Schema Pattern"
