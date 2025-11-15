# Architecture Decisions

Стратегические решения WHY (архитектура + tech choices). Детали implementation в Memory MCP.

---

## Salary fields as display-only (Core) vs filtering in Facade (2025-11-15)

Problem: Users need salary information for career transition analysis, but filtering logic can be complex (exact match, range overlap, wildcards, currency conversion).

Decision: Store salary fields (salaryExact, salaryMin, salaryMax) in Core Context schema, return AS IS in search results, but NO filtering/scoring in Core layer.

Why:
- **Separation of concerns**: Core = data storage + basic retrieval, Facade = business logic + LLM analysis
- **Flexibility**: LLM in Facade can handle nuanced salary matching (range overlap, "willing to accept lower for better role", etc.)
- **Simplicity**: Avoid complex Cypher WHERE clauses for salary range filtering
- **Consistency**: Follows existing pattern - Core returns data, Facade interprets

Alternative: Implement salary filtering in Core Cypher queries
→ Rejected because:
- Complex logic (range overlap, exact vs range matching, NULL handling)
- Inflexible (hardcoded rules vs LLM contextual analysis)
- Violates Core-Facade separation (Core should not make business decisions)

См. commit: f0976a5
См. MCP: Session 2025-11-15
