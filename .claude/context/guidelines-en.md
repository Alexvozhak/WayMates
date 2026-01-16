# Guidelines

Error patterns and project rules for WayMates. Format: mistake → rule.

---

## 1. Before Changing Code

### Grep similar places
Doing it my way instead of consistency → grep analogues (search-graph = reference for cold-start). If pattern exists — follow it.

### Check schema before editing prompt
Added field to prompt that doesn't exist in schema → read target Zod schema before editing extraction/planning prompt.

### Check buildHints
"map to KNOWN X" without dictionary → grep `buildHints()`, add type to array if missing.

### Compare types before unification
Suggested generic without comparing schemas → grep schemas, compare field by field before unification.

### Check regression
Fixed shared code, broke something else → run ALL related tests after editing classifier/prompts/router.

### Check eslint.config.mjs
Used `as` cast → check eslint.config.mjs before `as`, `any`, `!`. Forbidden — find type-safe alternative.

### Check all intents for phase
Changed one route, broke another → when changing routing check ALL intents for the phase. Table: intent → node → what it does.

### Check data flow to UI
Two sources of message conflict → trace ENTIRE data flow to UI before changing. One source of truth for each field.

### Evaluate business value
Refactoring "for consistency" → (1) What's the business value? (2) What breaks if NOT done? (3) Code works? → maybe not needed.

---

## 2. When Debugging

### Debug from end to start
Looked for problem in classification, bug was in response-builder → when output problem: (1) what NLP received, (2) what response-builder returned, (3) classification.

### Pipeline tracing
Spent long time guessing where problem is → logging at EVERY stage: Core → Facade → response-builder → NLP. Check prompt/data contract.

### Remove parts of query
Debug entire Cypher at once → remove parts one by one until result changes — found the problem.

### Which module to rebuild
Changed code, don't see effect → `src/cypher/`, `src/core/` → `core:rebuild`. `src/facade/` → `facade:rebuild`. `src/telegram-bot/` → `bot:docker:restart`.

---

## 3. LLM Prompts

### Semantics over specifics
Examples/quotes/templates in prompt → only semantics: WHAT and WHY, not HOW the phrase looks. `.describe()` too — generate dynamically.

### Dictionaries = source of truth
LLM invents values → inject position, domain, skill, industry into prompt. LLM matches semantically.

### Multilingual input
LLM expects English → "Response may be in any language" for Russian/mixed input.

### Phase context for classification
"want senior" = different intent in different phases → pass phase context to classifier.

### Phase instructions mutually exclusive
NLP for one phase applies instruction of another → instructions in PHASE_DESCRIPTIONS must be mutually exclusive.

### ONLY X, do NOT Y
"FIRST X, then Y" — LLM does both → "Show ONLY X. Do NOT show Y." Explicitly state what NOT to do.

### Structured schema > .describe()
LLM ignores `.describe()` → structured schema with separate fields, formatting in TypeScript. Schema = contract, describe = hint.

### NLP message depends on data
Instruction without data → verify data exists in response-builder before adding instruction to prompt.

### Prompt shows only valid intents
LLM chooses invalid intent → prompt must show ONLY valid intents. `getValidIntentsForPhase(phase, flags)`.

---

## 4. Types/Zod

### null consistently
Mixing null/undefined → `null` consistently. OpenAI requires nullable (not optional), Neo4j returns null, JSON has no undefined.

### Zod .parse() instead of as
`as Type` to silence TypeScript → Zod `.parse()` or typeguard. Cast = signal that types are wrong.

### z.enum instead of z.string
`z.array(z.string())` for limited values → `z.enum([...])` — LLM sees allowed values in JSON schema.

### keyof instead of strings
`type Field = "a" | "b"` duplicates keys → `keyof Pick<BusinessType, ...>`. TypeScript will require description when adding field.

### satisfies for type-safety
Array of strings without type connection → `[...] as const satisfies readonly Field[]`.

### Zod .options for values
Duplicating keys and values → use `schema.options` to extract enum values.

### hasValue() for emptiness
`??=` doesn't work with `[]` → `hasValue()` checks null, undefined, [], "". LLM may return `[]` instead of null.

### Zod error → human-readable
`.describe()` doesn't appear in error → create mapping field → message for human-readable errors.

---

## 5. LangGraph

### Clear userResponse
userResponse not cleared → after using `userResponse: ""` in return.

### 4 places when adding intent
Intent not added everywhere → (1) state.ts — arrays, (2) parse-intent.ts — schema, (3) prompts.ts — descriptions, (4) search-router.ts — route map.

### unknown → explicit route
Relying on fallback for unknown → explicit route `unknown` → `clarify_intent`.

### ask intent in every phase
"what can you do?" → cancel → `ask` intent must be in EVERY phase.

### interrupt() stops execution
Code after interrupt() doesn't execute → prepare data BEFORE interrupt or in previous node.

### State params propagate manually
Params lost after node → nodes that DON'T change params must return them.

### undefined → null for JSON
`JSON.stringify({a: undefined})` → `{}` → explicit `value ?? null`.

### Placeholder strings → builder functions
`.replace("{field}", value)` → builder function with explicit arguments. IDE suggests, TypeScript checks.

### proceed ≠ explore
"show similar" → proceed → wrong → `proceed` = pure confirmation, `explore` = request to see similar.

### Advisor not a dead end
Advisor without exit to main flow → generic `action` intent → routes to parse_search_intent.

### INTERRUPT nodes not intermediate
Routing to confirm_* to "return" → interrupt() ALWAYS stops. For return without interrupt — route to PARSE node.

---

## 6. Cypher

### WITH resets variables
Variable undefined after WITH → `WITH *` preserves all, `WITH x, y` — only x and y.

### Null safety for optional
`WHERE all(d IN c.domains ...)` without check → `CASE WHEN x IS NULL THEN true ELSE ... END` for optional properties.

### Map projection instead of TS mapping
Mapping fields in TypeScript → `RETURN { field1, computed: expr } AS result` — one cast in TypeScript.

### collect()[0] instead of LIMIT
`ORDER BY x LIMIT 1` after aggregation → for per-group limit: `collect(...)[0]` inside aggregation.

---

## 7. Tests

### Don't adjust assertion
Test fails → change assertion → investigate WHY. Test = business requirement, often it's a bug in code.

### Invariants, not specific output
Checking specific LLM output for edge case → check system invariants (didn't crash, phase valid).

### Negative assertions
Only "U5 found" → verify correct found + incorrect excluded.

### Current dates
Fixtures with 2022 dates → dates must be within production thresholds (recency = 12 months).

### Test data logic
User achieves goal before Pathfinder → verify data makes sense in business context.

### Don't play along with LLM
Scripted messages instead of reaction → read response → react by meaning. Toxic user doesn't know "correct" commands.

---

## 8. Work Process

### Pre-Action Declaration
Edit immediately without explanation → 90%+ confidence. **Problem** → **Current state** → **Proposed state** → **Confidence %**. Wait for "ok" before Edit.

### Don't guess
Making up business decisions / accepting "bug" without verification / making architectural statements without verification → ask business decisions explicitly, verify technical by code/docs, give confidence %.

### Search documentation first
Asking instead of searching → first GLOSSARY, BUSINESS-LOGIC, schemas. Ask only if not found.

### File not found — search
"File not found" without search → `Glob` by name (`**/*name*.md`).

### CLI script — read before using
Used non-existent flags (--session, --reset) → read script before using. telegram-chat.ts supports only `--start`, `--file`, `--wait-double`.

### Visual verification
Consider bug fixed → visual verification by user is mandatory.

### Add to matrix
Verified through mcp-chat.ts → add row to tests_report.md.

### Finished — wait for approval
Immediately next task → Pre-Action Declaration → wait for explicit "ok".

### UX is primary
Technical solution without UX → (1) "How does user experience this?", (2) "What has user already seen?" — don't duplicate, (3) test with natural speech.

### Don't delegate without consent
Task agent without permission → "Continue yourself" = work myself.

### Think about workflow
Implementing without understanding usage → "What's the workflow?" — think BEFORE implementation.

---

## 9. Code

### YAGNI
Fallbacks/wrappers "just in case" → add complexity only with proven necessity.

### DRY immediately
Duplication "for later" → HOF/abstraction immediately. 1 hour on HOF = savings on maintenance.

### Name = semantics
Function changed, name is old → semantics change → name changes.

### Business names
`isArray`, `contextMultiValue` → names should reflect business semantics. "How would product manager explain?"

### lint:fix for routine
Manual import cleanup → `lint:fix` removes unused, formats.

### Filesystem MCP for batch operations
SED for mass changes / many Read in a row → `mcp__filesystem__edit_file` for batch edit, `mcp__filesystem__read_multiple_files` for mass reading. Then `lint:fix` fixes imports.

### Fix in correct layer
Workaround in Facade for bug in Core → bug in Core → fix in Core.

### Ternary for 2 values
Map for 2 values → `key === "a" ? 1 : 2`. Map justified for 3+.

### Inline mess
`...(condition && { field })` → explicit variables or if/else.

### Env defaults = silent bugs
`.default()` for env → explicit required = fail fast. Better to crash immediately.

---

## 10. Communication

### Honest analysis
Confirming expectations → honest analysis > people-pleasing. Pros/cons, not "yes, of course!"

### Explain simply
Technical terms without explanation → "We print JS to file" clearer than "esbuild bundle injection".

### Clarify ambiguities
Assumptions instead of questions → better AskUserQuestion than redo.

### Solution with alternatives
One solution without rationale → (1) context, (2) options with +/-, (3) recommendation, (4) confidence %.

---

## 11. Code Review (check BEFORE "done")

### DRY (Don't Repeat Yourself)
One logic copied to 2+ places → extract to shared/reuse. `hashToken()` in 2 files → export from one.

### Single Source of Truth
Value/format defined in multiple places → use constant. `session:${id}` hardcode → `SessionService.sessionKeyPrefix`.

### Fail Fast
Hidden fallback masks error → explicit error is better. `?? ""` hides undefined → explicit check + throw.

### Dead Code / Rudiments
Refactoring left unused code → grep old imports/functions, delete if 0 usages.

### Consistency
Different style in same context → unify. `→` vs `->` in comments → choose one.

### SRP (Single Responsibility)
Function does 2 things → split. Sign: `fn() { doA(); doB(); mutateState(); }`.

### Explicit over Implicit
Side effects hidden → explicitly return result. `withRetry` mutates ctx → returns userInfo.

### Type Safety
TypeScript bypass instead of proper types → typed errors, discriminated unions. `Error` → `McpClientError` with code.

### No Magic Values
Literals without explanation → constants with names. `100_000` → `FIXTURE_TELEGRAM_ID_OFFSET`.

### Minimal API Surface
Export internal helper → export only public API. Tests use internal → add test-only export or method.

### Run tests before "done"
Suggested deploy without tests → `npm run test:*` MANDATORY before "ready to deploy".
