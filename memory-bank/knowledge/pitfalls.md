# Pitfalls (Грабли)

## Neo4j / Cypher

### Parameter handling
- **disableLosslessIntegers не работает для input** - только для output values
- **WITH drops parameters** - нужно explicit aliasing: `WITH $param AS p`
- **Reserved keywords** - "context" может быть зарезервирован в Neo4j 5

**Детали**: См. [cypher-mistakes.md](cypher-mistakes.md) + Memory MCP `Neo4j 5 GQL Parameter Rules`

---

### Variable scope
- **WITH clause scope** - все переменные должны быть явно перечислены или `WITH *`
- **Variable naming conflicts** - node variables vs alias variables в одном scope

**Детали**: См. [cypher-mistakes.md](cypher-mistakes.md#2-variable-scope-теряется-после-with)

---

### Query patterns
- **Unbounded patterns** - `*` без upper bound может взорвать граф traversal
- **OPTIONAL before MATCH** - нарушает null propagation
- **WHERE after FOREACH** - syntax error, используй UNWIND

**Детали**: См. [cypher-mistakes.md](cypher-mistakes.md)

---

## TypeScript / Zod

### Schema validation
- **Empty arrays** - `[]` в FieldFilter.values → validation error (нужен .min(1))
- **birthYear location** - на Context node, НЕ на User node
- **skills array** - уже string[] после Zod transform, не objects

**Детали**: См. Memory MCP `Empty_Array_Validation_Decision`, `Schema Property Locations`

---

### Type imports
- **Dual-source imports** - не импортируй из schemas-zod.ts И shared/schemas.ts одновременно
- **PascalCase vs camelCase** - schemas теперь camelCase (после 2025-11-10 migration)

**Детали**: См. Memory MCP `camelCase Migration Completion`

---

## Testing

### Vitest
- **Sequential execution** - singleThread: true ОБЯЗАТЕЛЬНО для WRITE operations
- **Test data dates** - избегай future dates (fails timeSinceMatchedMonths >= 0 validation)
- **Database cleanup** - beforeEach MUST run `MATCH (n) DETACH DELETE n`

**Детали**: См. Memory MCP `Sequential Test Execution Pattern`, `Test Data Date Issue`

---

### Test data
- **U1-U9** - базовые scenarios (adhoc search)
- **U10-U13** - DTW scenarios (trajectories ≥ 3 contexts)
- **Enum values** - position suffixes removed (Junior Backend → Junior)

**Детали**: См. Memory MCP `Test Data U10-U13`

---

## ESLint / TypeScript

### Common issues
- **Inline type annotations** - грязно, лучше file-based config
- **non-null assertions** - 16 warnings acceptable для tests
- **Trail camelCase** - 5 TypeScript errors (известная проблема, tests work via Zod)

**Детали**: См. [../project-state/linting.md](../project-state/linting.md)

---

## Performance

### DTW calculations
- **Duplicate durations** - calculateDurationMonths вызывался 6 раз вместо 2
- **Duplicate DTW** - Shape+Stability можно вычислить за 1 DTW вместо 2
- **StepWithDuration** - создавай wrapper 1 раз, не 4

**Детали**: См. Memory MCP `Reviewer Agent DRY Analysis`, `Inline DTW Calculations Pattern`

---

*Добавляй новые грабли по мере обнаружения!*
