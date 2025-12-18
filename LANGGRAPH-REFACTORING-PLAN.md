# LangGraph Architecture Refactoring Plan

**Дата:** 2025-12-18
**Статус:** DRAFT
**Scope:** cold-start-v2, search-graph, shared utilities

---

## Проблемы (Summary)

| # | Проблема | Severity | Где |
|---|----------|----------|-----|
| 1 | SRP violation: parseUserIntent в 5 show_* нодах | HIGH | search-graph |
| 2 | userResponse очистка в 5 местах | HIGH | search-graph |
| 3 | Дублирование destinations (router + mapping) | MEDIUM | оба графа |
| 4 | Inconsistent failed handling (4/6 routers) | MEDIUM | cold-start-v2 |
| 5 | decisionSchema дубликаты (3 места) | MEDIUM | cold-start-v2, shared |
| 6 | extractInterruptPhase: z.string() + dead code | LOW | search-graph |
| 7 | Реэкспорты PHASE (цепочка) | LOW | оба графа |
| 8 | Type guards vs Zod validation | LOW | оба графа |

---

## Архитектура после рефакторинга

### Shared Utilities

```
src/facade/langGraph/shared/
├── state-utils.ts              # lastValue, StateUpdate<S> (existing + add type)
├── types.ts                    # GraphDeps, hasConfigDeps (existing)
├── routing.ts                  # buildRouteMap (move from search-graph)
├── interrupt-utils.ts          # createInterruptPhaseExtractor (NEW)
├── intents.ts                  # BASE_INTENTS + descriptions (NEW)
└── decision.ts                 # DELETE (move to per-graph)
```

### Per-Graph Changes

**cold-start-v2:**
- types.ts: decisionSchema (extends BASE_INTENTS + "continue")
- decision-router.ts: add failed handling to ALL routers
- cold-start-graph.ts: use Zod validation, remove re-exports

**search-graph:**
- state.ts: add searchPhaseSchema, searchStateSchema
- nodes/parse-search-intent.ts: NEW — extracted parse node
- nodes/show-*.ts: SIMPLIFIED — only interrupt, no parsing
- search-graph.ts: new edges, typed extractInterruptPhase
- search-router.ts: typed destinations

---

## Phase 1: Shared Utilities (Foundation)

### 1.1 Modify `shared/state-utils.ts`

```typescript
// ADD:
export type StateUpdate<S> = Partial<S>;
```

### 1.2 Create `shared/routing.ts`

```typescript
// Move from search-graph/search-router.ts + improve

export function buildRouteMap<T extends string>(
  destinations: readonly T[],
): Record<T, T> {
  return Object.fromEntries(destinations.map((d) => [d, d])) as Record<T, T>;
}
```

### 1.3 Create `shared/interrupt-utils.ts`

```typescript
import { z } from "zod";
import type { StateSnapshot } from "@langchain/langgraph";

export function createInterruptPhaseExtractor<P extends string>(
  phaseSchema: z.ZodEnum<[P, ...P[]]>,
): (snapshot: StateSnapshot) => P | undefined {
  const schema = z.object({ phase: phaseSchema.optional() });

  return (snapshot) => {
    const task = snapshot.tasks[0];
    if (!task) return undefined;

    const interrupt = task.interrupts[0];
    if (!interrupt) return undefined;

    const parsed = schema.safeParse(interrupt.value);
    return parsed.success ? parsed.data.phase : undefined;
  };
}
```

### 1.4 Create `shared/intents.ts`

```typescript
import { z } from "zod";

export const BASE_INTENTS = ["approve", "edit", "cancel"] as const;
export const baseIntentSchema = z.enum(BASE_INTENTS);
export type BaseIntent = z.infer<typeof baseIntentSchema>;

export const INTENT_DESCRIPTIONS: Record<string, string> = {
  approve: "User confirms, agrees, accepts (yes, ok, да)",
  edit: "User wants to change something (edit, change, изменить)",
  cancel: "User wants to stop completely (cancel, stop, отмена)",
};
```

### 1.5 Create `shared/state-validation.ts`

```typescript
import { z } from "zod";
import { AgentInvariantError } from "../../errors.js";

export function createStateValidator<T>(
  schema: z.ZodType<T>,
  name: string,
): (values: unknown) => T {
  return (values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      throw new AgentInvariantError(`to${name}State`, result.error.message);
    }
    return result.data;
  };
}
```

---

## Phase 2: cold-start-v2 Cleanup

### 2.1 Consolidate decisionSchema in `types.ts`

```typescript
import { baseIntentSchema, BASE_INTENTS } from "../shared/intents.js";

export const coldStartIntentSchema = z.enum([...BASE_INTENTS, "continue"]);
export type ColdStartIntent = z.infer<typeof coldStartIntentSchema>;

export const decisionSchema = z.object({
  intent: coldStartIntentSchema,
  editTarget: z.string(),
  editInstructions: z.string(),
});
```

### 2.2 Remove duplicate from `state.ts`

```typescript
// REMOVE lines 22-30 (decisionSchema duplicate)
// REMOVE line 11: export { PHASE } from "./types.js"
// Import directly where needed
```

### 2.3 Add failed handling to ALL routers in `decision-router.ts`

```typescript
// ADD to routeAfterStoryDecision, routeAfterPlanDecision,
// routeAfterContextDecision, routeAfterFinalDecision:

if (state.phase === PHASE.failed) return NODE.cancel;
```

### 2.4 Use Zod validation in `cold-start-graph.ts`

```typescript
import { createStateValidator } from "../shared/state-validation.js";
import { coldStartStateSchema } from "./types.js";

// REMOVE isColdStartState function
const toColdStartState = createStateValidator(coldStartStateSchema, "ColdStart");

// REMOVE line 38: export { PHASE } from "./state.js";
```

---

## Phase 3: search-graph Refactoring

### 3.0 Routing Architecture Decision

**Выбор: Вариант A — один parse + один router с data-driven routing**

```
show_exploration ─┐
show_goal ────────┼──► parse_search_intent ──► routeByPhaseAndIntent ──► target node
ask_after_validate┤
show_results ─────┘
```

**Почему:**
- DRY — одна parse нода
- Централизованная логика — весь routing в одном месте
- Defensive programming — `if (phase === "failed")` один раз
- Data-driven — логика как таблица, не вложенные switch/case

### 3.1 Add schemas and NODE to `state.ts`

```typescript
import { z } from "zod";

// Add new node to NODE enum
export const NODE = {
  // ... existing nodes
  parse_search_intent: "parse_search_intent",  // NEW
} as const;

// Single source of truth for phases
export const searchPhaseSchema = z.enum([
  "checking_goal",
  "exploring",
  "showing_exploration",
  "extracting_goal",
  "showing_goal",
  "clarifying_goal",
  "validating_goal",
  "asking_after_validate",
  "setting_goal",
  "deleting_goal",
  "searching",
  "showing_results",
  "cancelled",
  "failed",
]);

export type SearchPhase = z.infer<typeof searchPhaseSchema>;
export const PHASE = searchPhaseSchema.Values;

// For Zod validation
export const searchStateSchema = z.object({
  phase: searchPhaseSchema,
  userId: z.string(),
  userResponse: z.string(),
  // ... all fields
});
```

### 3.2 Create `nodes/parse-search-intent.ts`

```typescript
import { parseUserIntent } from "./parse-intent.js";
import type { StateUpdate } from "../../shared/state-utils.js";
import type { SearchStateType } from "../state.js";
import type { TargetSearchParamsWithFeedback } from "../types.js";

export async function parseSearchIntentNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<StateUpdate<SearchStateType>> {
  const { userResponse, extractedGoal } = state;

  const parsed = await parseUserIntent(userResponse);

  // Clean variable assignment — no inline spreads
  const intent = parsed.intent;
  const clarificationText = intent === "clarify" ? parsed.clarificationText : null;

  // Handle filter params for validate intent
  let targetSearchParams: TargetSearchParamsWithFeedback | null = null;
  if (intent === "validate" && parsed.filters && extractedGoal) {
    const { normalizer } = config.configurable;
    const { normalized, rejected } = await normalizer.normalizeReasons(
      parsed.filters.excludedCreationReasons ?? []
    );

    targetSearchParams = {
      targetContext: extractedGoal,
      excludedCreationReasons: normalized,
      recencyThresholdMonths: parsed.filters.recencyThresholdMonths ?? undefined,
      limit: clampLimit(parsed.filters.limit),
      rejectedReasons: rejected,
    };
  }

  return {
    searchUserIntent: intent,
    clarificationText,
    targetSearchParams,
  };
}

function clampLimit(limit: number | null | undefined): number {
  if (!limit) return DEFAULT_LIMIT;
  return Math.min(Math.max(limit, MIN_LIMIT), MAX_LIMIT);
}
```

### 3.3 Simplify `nodes/show-goal.ts`

```typescript
import { interrupt } from "@langchain/langgraph";
import { AgentInvariantError } from "../../../errors.js";
import { NODE, OPTIONS, PHASE } from "../state.js";
import type { StateUpdate } from "../../shared/state-utils.js";
import type { SearchStateType } from "../state.js";

export function showGoalNode(state: SearchStateType): StateUpdate<SearchStateType> {
  const { extractedGoal, userResponse: stateUserResponse } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist");
  }

  // Use existing userResponse if available (from load_existing_goal flow)
  const hasExistingResponse = stateUserResponse && stateUserResponse !== "";
  if (hasExistingResponse) {
    return { phase: PHASE.showingGoal };
  }

  // Otherwise interrupt for user input
  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    options: OPTIONS.showGoal,
    phase: PHASE.showingGoal,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showingGoal,
  };
}
```

### 3.4 Simplify other show_* nodes

**show-exploration.ts:**
```typescript
export function showExplorationNode(state: SearchStateType): StateUpdate<SearchStateType> {
  const userResponse = interrupt({
    type: "show_exploration",
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
    phase: PHASE.showingExploration,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showingExploration,
  };
}
```

**show-results.ts:**
```typescript
export async function showResultsNode(state: SearchStateType): Promise<StateUpdate<SearchStateType>> {
  const chartUrl = await generateChartIfEnabled(state);

  const userResponse = interrupt({
    type: "show_results",
    results: state.searchResults,
    goal: state.existingGoal,
    chartUrl,
    options: OPTIONS.showResults,
    phase: PHASE.showingResults,
  });

  return {
    userResponse: String(userResponse),
    chartUrl: chartUrl ?? null,
    phase: PHASE.showingResults,
  };
}
```

**ask-after-validate.ts:**
```typescript
export function askAfterValidateNode(state: SearchStateType): StateUpdate<SearchStateType> {
  const userResponse = interrupt({
    type: "ask_after_validate",
    candidates: state.validationResults,
    message: "Based on these trajectories, is this the goal you want?",
    options: OPTIONS.askAfterValidate,
    phase: PHASE.askingAfterValidate,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.askingAfterValidate,
  };
}
```

### 3.5 Remove userResponse clearing from other nodes

**load-context.ts:**
```typescript
// REMOVE: userResponse: ""
return { adhocContext };
```

**extract-goal.ts:**
```typescript
// REMOVE: userResponse: ""
return { extractedGoal, phase: PHASE.showingGoal, messages };
```

**clarify-goal.ts:**
```typescript
// REMOVE: userResponse: ""
return { extractedGoal: updated, clarifyRound: clarifyRound + 1, phase: PHASE.showingGoal, messages };
```

**load-existing-goal.ts:**
```typescript
// REMOVE conditional clear
return {
  extractedGoal: existingGoal.targetCriteria,
  clarifyRound: 0,
};
```

### 3.6 Update `search-graph.ts`

```typescript
import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";
import { createStateValidator } from "../shared/state-validation.js";
import { parseSearchIntentNode } from "./nodes/parse-search-intent.js";
import { searchPhaseSchema, searchStateSchema } from "./state.js";

// Typed interrupt extractor
const extractInterruptPhase = createInterruptPhaseExtractor(searchPhaseSchema);

// Zod validation
const toSearchState = createStateValidator(searchStateSchema, "Search");

// In createGraphBuilder():
.addNode(NODE.parse_search_intent, parseSearchIntentNode)

// Updated edges:
.addEdge(NODE.show_exploration, NODE.parse_search_intent)
.addConditionalEdges(NODE.parse_search_intent, routeAfterShowExploration, ...)

.addEdge(NODE.show_goal, NODE.parse_search_intent)
.addConditionalEdges(NODE.parse_search_intent, routeAfterShowGoal, ...)

// etc. for other show_* nodes

// REMOVE line 233: export { PHASE } from "./state.js";
// REMOVE dead code line 187: return phaseValue;
```

### 3.7 Rewrite `search-router.ts` with data-driven routing

```typescript
import { buildRouteMap } from "../shared/routing.js";
import { MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE } from "./state.js";
import type { NodeName, SearchPhase, SearchStateType, SearchUserIntent } from "./state.js";

// =============================================================================
// DATA-DRIVEN ROUTING TABLES
// =============================================================================

type IntentRoutes = Partial<Record<SearchUserIntent, NodeName>>;

const PHASE_ROUTES: Partial<Record<SearchPhase, IntentRoutes>> = {
  [PHASE.showingExploration]: {
    proceed: NODE.extract_goal,
    filter: NODE.apply_filters,
    cancel: NODE.cancel,
  },
  [PHASE.showingGoal]: {
    validate: NODE.validate_goal,
    clarify: NODE.clarify_goal,
    save: NODE.set_goal,
    cancel: NODE.cancel,
  },
  [PHASE.askingAfterValidate]: {
    save: NODE.set_goal,
    clarify: NODE.clarify_goal,
    change: NODE.extract_goal,
    cancel: NODE.cancel,
  },
  [PHASE.showingResults]: {
    change: NODE.load_existing_goal,
    delete: NODE.delete_goal,
    filter: NODE.apply_filters,
    cancel: NODE.cancel,
  },
};

const PHASE_DEFAULTS: Partial<Record<SearchPhase, NodeName>> = {
  [PHASE.showingExploration]: NODE.extract_goal,  // unknown → proceed
  [PHASE.showingGoal]: NODE.set_goal,             // unknown → save
  [PHASE.askingAfterValidate]: NODE.set_goal,     // unknown → save
  [PHASE.showingResults]: NODE.cancel,            // unknown → done
};

// All possible destinations for buildRouteMap
const ALL_INTENT_DESTINATIONS = [
  NODE.extract_goal,
  NODE.apply_filters,
  NODE.validate_goal,
  NODE.clarify_goal,
  NODE.set_goal,
  NODE.load_existing_goal,
  NODE.delete_goal,
  NODE.cancel,
  // Loop-back nodes for "unknown" intent
  NODE.show_exploration,
  NODE.show_goal,
  NODE.ask_after_validate,
  NODE.show_results,
] as const;

type IntentDestination = (typeof ALL_INTENT_DESTINATIONS)[number];

// =============================================================================
// MAIN ROUTER (after parse_search_intent)
// =============================================================================

export function routeByPhaseAndIntent(state: SearchStateType): IntentDestination {
  const { phase, searchUserIntent, clarifyRound, newPositionRound } = state;

  // Defensive: failed phase always → cancel
  if (phase === PHASE.failed) return NODE.cancel;

  // Get routes for current phase
  const routes = PHASE_ROUTES[phase];
  if (!routes) return NODE.cancel;

  const intent = searchUserIntent ?? "unknown";

  // Special case: clarify with max rounds exceeded
  if (intent === "clarify" && clarifyRound >= MAX_CLARIFY_ROUNDS) {
    return NODE.set_goal;
  }

  // Special case: change with max rounds exceeded (ask_after_validate)
  if (intent === "change" && phase === PHASE.askingAfterValidate) {
    if (newPositionRound >= MAX_NEW_POSITION_ROUNDS) {
      return NODE.set_goal;
    }
  }

  // Special case: unknown intent → loop back to same show node
  if (intent === "unknown") {
    const loopBackNodes: Partial<Record<SearchPhase, NodeName>> = {
      [PHASE.showingExploration]: NODE.show_exploration,
      [PHASE.showingGoal]: NODE.show_goal,
      [PHASE.askingAfterValidate]: NODE.ask_after_validate,
      [PHASE.showingResults]: NODE.show_results,
    };
    return loopBackNodes[phase] ?? NODE.cancel;
  }

  // Standard routing
  return routes[intent] ?? PHASE_DEFAULTS[phase] ?? NODE.cancel;
}

// =============================================================================
// OTHER ROUTERS (unchanged logic, kept for non-intent edges)
// =============================================================================

export function routeAfterCheckGoal(state: SearchStateType): NodeName {
  return state.existingGoal ? NODE.load_existing_goal : NODE.explore;
}

export function routeAfterApplyFilters(state: SearchStateType): NodeName {
  return state.existingGoal ? NODE.search : NODE.explore;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { buildRouteMap } from "../shared/routing.js";

export const INTENT_ROUTE_MAP = buildRouteMap(ALL_INTENT_DESTINATIONS);
```

### 3.8 Update `search-graph.ts` with new edges

```typescript
import { parseSearchIntentNode } from "./nodes/parse-search-intent.js";
import {
  routeByPhaseAndIntent,
  routeAfterCheckGoal,
  routeAfterApplyFilters,
  INTENT_ROUTE_MAP,
} from "./search-router.js";

// In createGraphBuilder():

// Add parse node
.addNode(NODE.parse_search_intent, parseSearchIntentNode)

// All show_* nodes lead to parse_search_intent
.addEdge(NODE.show_exploration, NODE.parse_search_intent)
.addEdge(NODE.show_goal, NODE.parse_search_intent)
.addEdge(NODE.ask_after_validate, NODE.parse_search_intent)
.addEdge(NODE.show_results, NODE.parse_search_intent)

// Single conditional edge from parse to all destinations
.addConditionalEdges(
  NODE.parse_search_intent,
  routeByPhaseAndIntent,
  INTENT_ROUTE_MAP,
)

// Non-intent edges (unchanged)
.addEdge(START, NODE.load_context)
.addEdge(NODE.load_context, NODE.check_goal)
.addConditionalEdges(
  NODE.check_goal,
  routeAfterCheckGoal,
  buildRouteMap([NODE.search, NODE.explore, NODE.load_existing_goal]),
)
.addEdge(NODE.explore, NODE.show_exploration)
.addEdge(NODE.extract_goal, NODE.show_goal)
.addEdge(NODE.clarify_goal, NODE.show_goal)
.addEdge(NODE.validate_goal, NODE.ask_after_validate)
.addEdge(NODE.set_goal, NODE.search)
.addEdge(NODE.search, NODE.show_results)
.addEdge(NODE.load_existing_goal, NODE.show_goal)
.addEdge(NODE.delete_goal, NODE.explore)
.addConditionalEdges(
  NODE.apply_filters,
  routeAfterApplyFilters,
  buildRouteMap([NODE.explore, NODE.search]),
)
.addEdge(NODE.cancel, END)
```

---

## Phase 4: Cleanup

### 4.1 Delete `shared/decision.ts`

После миграции cold-start-v2 на свой decisionSchema — удалить shared версию.

### 4.2 Update imports in upsert-context, upsert-trail, update-context

Если используют shared/decision.ts — обновить на локальные версии или BASE_INTENTS.

### 4.3 Run tests

```bash
npm run lint:fix
npx tsc --noEmit
npm run test:integration
```

---

## Special Case: apply-filters.ts

**Решение:** Оставить как есть.

`apply-filters` — это processing node, не просто routing:
- Нормализует excludedContextFields
- Нормализует excludedCreationReasons
- Применяет clamping для limit
- Возвращает appliedFilters с feedback

Это бизнес-логика, не только intent classification.

---

## Breaking Changes

| Изменение | Impact | Mitigation |
|-----------|--------|------------|
| Новая parse_search_intent нода | Меняет граф | Тесты покрывают |
| searchUserIntent timing | После parse ноды | Internal |
| Import paths | Re-export removal | Find & replace |
| Checkpoint compatibility | May invalidate | Fresh start for users |

---

## Migration Order

1. **Phase 1:** Shared utilities (NO breaking changes)
2. **Phase 2:** cold-start-v2 cleanup (internal refactor)
3. **Phase 3:** search-graph refactor (graph structure change)
4. **Phase 4:** Cleanup & tests

---

## Files to Modify

### Create (NEW):
- `src/facade/langGraph/shared/routing.ts`
- `src/facade/langGraph/shared/interrupt-utils.ts`
- `src/facade/langGraph/shared/intents.ts`
- `src/facade/langGraph/shared/state-validation.ts`
- `src/facade/langGraph/search-graph/nodes/parse-search-intent.ts`

### Modify:
- `src/facade/langGraph/shared/state-utils.ts` (add StateUpdate type)
- `src/facade/langGraph/cold-start-v2/types.ts` (consolidate decisionSchema)
- `src/facade/langGraph/cold-start-v2/state.ts` (remove duplicate, re-exports)
- `src/facade/langGraph/cold-start-v2/decision-router.ts` (add failed handling)
- `src/facade/langGraph/cold-start-v2/cold-start-graph.ts` (Zod validation, remove re-exports)
- `src/facade/langGraph/search-graph/state.ts` (add schemas, add NODE.parse_search_intent)
- `src/facade/langGraph/search-graph/search-graph.ts` (new edges, fix dead code, remove old conditional edges)
- `src/facade/langGraph/search-graph/search-router.ts` (REWRITE: data-driven routing, remove old per-phase routers)
- `src/facade/langGraph/search-graph/nodes/show-goal.ts` (simplify: only interrupt, remove parseUserIntent)
- `src/facade/langGraph/search-graph/nodes/show-exploration.ts` (simplify: only interrupt, remove parseUserIntent)
- `src/facade/langGraph/search-graph/nodes/show-results.ts` (simplify: only interrupt, remove parseUserIntent)
- `src/facade/langGraph/search-graph/nodes/ask-after-validate.ts` (simplify: only interrupt, remove parseUserIntent)
- `src/facade/langGraph/search-graph/nodes/load-context.ts` (remove userResponse: "" clear)
- `src/facade/langGraph/search-graph/nodes/extract-goal.ts` (remove userResponse: "" clear)
- `src/facade/langGraph/search-graph/nodes/clarify-goal.ts` (remove userResponse: "" clear)
- `src/facade/langGraph/search-graph/nodes/load-existing-goal.ts` (remove conditional userResponse clear)

### Delete:
- `src/facade/langGraph/shared/decision.ts` (after Phase 4)
