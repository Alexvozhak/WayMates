# Key Decisions (Важные решения)

## Test Data Import: Node.js Module Cache (2025-11-12)
**Проблема**: После изменения JSON тестовых данных (`data/trails/users/u*.json`) тесты используют старые данные из cache.

**Причина**: `test-data-manager.ts` импортирует JSON напрямую → Node.js кеширует модули.

**Решение**: См. `package.json` скрипты `test:*` для правильного перезапуска тестов после изменения JSON.

**См.**: Bug #2.4 fix, tests/helpers/test-data-manager.ts

---

## Helper Functions Pattern for Cypher (2025-11-11)
**Решение**: Helper Functions pattern для Cypher query composition (вместо DSL/Builder chains)

**Структура**: `src/cypher/{nodes, patterns, enrichment, helpers, queries}/`

**Ключевые паттерны**:
- **Compositor pattern**: `enrichContext()` возвращает `{patterns, withClause, projection}`, не выполняет side effects
- **Functional composition**: `applyOptionalMatches(query, patterns)` вместо imperative loops
- **MapProjection**: `new Cypher.MapProjection(node, ['.field'], {extra})` для Neo4j convention

**Причина**: Композиция через конфиги читаемее fluent chains. Разделение concerns: helpers знают Cypher API, business queries только композируют.

**См. commit**: `3dc48d9`

---

## Skills Never in WHERE Clause (2025-11-11)
**Context**: AC2 test failing - skills в WHERE требовали exact match (U1 react не находил U4 svelte), но scoring logic требовал penalty-based градацию

**Decision**: Skills NEVER participate в WHERE clause filtering - всегда excluded из `computeStrictFields()`

**Why**:
- Skills нуждаются в penalty-based scoring (градация по весам из БД), не boolean exact-match
- WHERE с skills слишком restrictive - excludes candidates с разными skills
- Без skills penalties нет способа ранжировать кандидатов (все score = 1.0)

**Implementation**:
- `computeStrictFields()` always filters 'skills' из strictFields (`field !== 'skills'`)
- Schema validation forbids 'skills' в `excludedContextFields` (`.refine()`)
- Penalties всегда applied в scoring: `score = 1.0 - (sum(penalties) / 100)`

**Alternative**: Skills in WHERE as INTERSECTION (`ANY(s IN $ref.skills WHERE s IN cand.skills)`) - rejected (too complex, loses penalty weights)

**См. Memory MCP**: `Skills Scoring Architecture Decision 2025-11-11`, `AC2 Score Mismatch Investigation`

---

## InPath Suffix Pattern (2025-11-10)
**Context**: target-query-builder.ts has trajectory and matched context в одном scope

**Decision**: Используй `InPath` suffix для trajectory variables (contextInPath, positionInPath, workDomainInPath)

**Why**: Avoids naming conflicts с matched context variables (context, position, workDomain)

**Alternative**: Prefixed names (ctx_, tp_, twd_) - rejected (less readable, not semantic)

**См. Memory MCP**: `CypherNamingConflict_TargetQueryBuilder`

---

## Sequential Tests for Write Operations (2025-11-10)
**Context**: Story Manager tests were flaky с parallel execution

**Decision**: `singleThread: true` в vitest config

**Why**: Prevents database race conditions с WRITE operations (MERGE, CREATE)

**Alternative**: Parallel with DB locks - rejected (too complex, overkill)

**См. Memory MCP**: `Sequential Test Execution Pattern`

---

## camelCase для Everything (2025-11-08)
**Context**: Mixed snake_case/camelCase across TypeScript, API, Database

**Decision**: camelCase everywhere (TypeScript + Neo4j properties)

**Why**:
- JavaScript idiom (camelCase)
- Neo4j official recommendation (not enforced, but recommended)
- Consistency across layers

**Alternative**: Keep snake_case в DB - rejected (breaks consistency)

**Breaking change**: Yes (80+ properties, 26 DB constraints/indexes)

**См. Memory MCP**: `ESLint Strict Migration 2025-11-10`

---

## OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS Constant (2025-11-10)
**Context**: Duplicated OPTIONAL MATCH blocks в 3 query builders

**Decision**: Extract to cypher-snippets.ts constant

**Why**: DRY principle, -11 lines net savings

**Limitations**:
- Cannot apply в target-query-builder.ts (uses InPath variables)
- Cannot apply в persistence-query-builder.ts (has [:IN_CATEGORY] relationships)

**См. Memory MCP**: `OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS_Constant`

---

## Query Builder Pattern 1 (2025-11-06)
**Context**: Query builders были inconsistent (some return string, some return {query, params})

**Decision**: Pattern 1 - return string only, parameters passed to tx.run()

**Why**:
- Separation of concerns
- Easier testing
- No parameter name conflicts
- Simpler signature

**Alternative**: Return {query, params} - rejected (harder to test, parameter conflicts)

**См. Memory MCP**: `Query_Builder_Pattern_1`

---

## Empty Array Validation (2025-11-07)
**Context**: Cypher 'p.name IN []' → false (0 results), contradicts 'show all' intent

**Decision**: Forbid empty arrays в FieldFilter.values via `.min(1)` validation

**Why**: Prevent ambiguous semantics ([] = show all vs show none?)

**Alternative**: Allow [] to mean 'show all' - rejected (ambiguous)

**Solution**: Use undefined для 'no filter', require ≥ 1 value if field present

**См. Memory MCP**: `Empty_Array_Validation_Decision`

---

## StepWithDuration Wrapper Pattern (2025-11-09)
**Context**: dynamic-time-warping-ts library accepts only (a, b) signature

**Decision**: Adapter pattern - wrap UserContext + duration в {context, duration}

**Why**: Library не поддерживает custom distance с durations, но мы нуждаемся в них для calculation

**Alternative**: Self-written DTW - rejected (too complex, reinventing wheel)

**См. Memory MCP**: `StepWithDuration Pattern`

---

## Inline DTW Calculations (2025-11-09)
**Context**: calculateDurationMonths вызывался 6 раз, DTW 3 раза (performance issue)

**Decision**: Single computeDTWMetrics() method вместо 3 separate methods

**Why**:
- Durations computed 1 раз вместо 6 раз (3x speedup)
- Wrappers created 1 раз вместо 4 раз (2x speedup)
- Single DTW для Shape+Stability вместо 2 calls (1.5x speedup)
- Total: 2x performance gain (280→140 operations per candidate)

**Trade-off**: 60-line method vs 3 shorter methods, justified by performance

**См. Memory MCP**: `Inline DTW Calculations Pattern`, `Reviewer Agent DRY Analysis`

---

## Preset-Based ESLint Config (2025-11-10)
**Context**: Manual plugin registration verbose и error-prone

**Decision**: Use `importX.flatConfigs.recommended` вместо manual registration

**Why**:
- Shorter config (10 lines vs 50 lines)
- Official recommended rules
- Auto-maintained by plugin authors

**Alternative**: Manual registration - rejected (verbose, hard to maintain)

**См. Memory MCP**: `ESLint 9 Flat Config Best Practices`

---

## Test-Specific ESLint Rules (2025-11-10)
**Context**: Tests нуждаются в relaxed rules (long functions, no return types)

**Decision**: File-based config для tests/**/*.ts вместо inline disabling

**Why**: Clean solution vs inline hacks (user feedback: "как то грязно inline тип")

**Rules relaxed**:
- explicit-function-return-type off (test readability)
- max-lines-per-function off (integration tests are long)
- import-x/no-default-export off (vitest.config.ts requires default)

**См. Memory MCP**: `Test-Specific ESLint Configuration`

---

*Добавляй новые решения по мере принятия!*
