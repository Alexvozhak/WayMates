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

---

## Binary language matching (B2+ only) vs CEFR levels (2025-11-15)

Problem: Users need language filtering for career search, but language proficiency has 6 CEFR levels (A1-C2). Should we store detailed levels or simplify?

Decision: Store only languages array (ISO 639-1 codes) without proficiency levels. Presence in array = B2+ (work-ready fluent).

Why:
- **MVP simplicity**: Binary "fluent or not" sufficient for initial release
- **Data quality**: Users often don't know exact CEFR level, easier to self-assess "work-ready" yes/no
- **Schema simplicity**: Array of strings vs complex objects [{code, level}]
- **Query simplicity**: Simple array membership vs level comparisons in Cypher

Alternative: Store CEFR levels (A1-C2) for each language
→ Rejected because:
- Overengineering for MVP (no user demand for granular levels yet)
- Complex data entry UX (users selecting levels they don't understand)
- Complex filtering logic (C1 matches B2 requirement? What about B1?)

Future: Can extend schema to [{code, level}] if business needs emerge.

См. commit: 7effe23
См. MCP: Session 2025-11-15-languages

---

## AND vs OR logic in language filtering modes (2025-11-15)

Problem: Different search modes need different language matching logic. Should adhoc/current use same logic as target search?

Decision:
- Adhoc/Current strict mode: AND logic (must have ALL specified languages)
- Target desired mode: OR logic (match ANY of specified languages)

Why:
- **Semantic consistency**:
  - Adhoc/Current = "who matches MY requirements" → strict match (I need both en AND de)
  - Target = "who reached MY goal" → flexible match (they had en OR fr, still succeeded)
- **User expectations**: When searching current context, users expect exact match. When searching target, users explore possibilities.
- **Real-world scenarios**: Career transitions don't require exact language match, but current job fit does.

Alternative: Use same logic (AND or OR) for all modes
→ Rejected because:
- Violates user mental models (current = strict, target = exploratory)
- Reduces search utility (target search would return too few results with AND)

См. commit: 7effe23
См. Task file: tasks/features/FEAT-018.md:256-264
