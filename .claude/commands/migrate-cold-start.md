---
description: "Миграция Cold-Start Agent с LangChain на LangGraph StateGraph"
allowed-tools: ["Read", "Edit", "Write", "Task", "AskUserQuestion", "Bash", "TodoWrite", "Glob", "Grep"]
---

# 🔄 Migrate Cold-Start to LangGraph

## Цель

Реализовать новую версию `ColdStartWorkflow` на LangGraph StateGraph согласно плану миграции.

**Критерий успеха**: T03 тест проходит 5/5 раз с gpt-4o-mini.

---

## Обязательный контекст

**ПЕРЕД началом работы** прочитай эти файлы:

1. **План миграции**: `docs/research/langgraph-migration/MIGRATION-PLAN.md`
2. **LangGraph Guide**: `poc/langgraph-cold-start/LANGGRAPH-GUIDE.md`
3. **Проверенные POC**: `poc/langgraph-cold-start/` (6 POC с примерами API)

**Из текущей реализации** (для переиспользования):

4. **Types**: `src/facade/langchain/cold-start/types.ts`
5. **Prompts**: `src/facade/langchain/cold-start/prompts.ts`
6. **Response builders**: `src/facade/langchain/cold-start/response-builders.ts`
7. **Extraction logic**: `src/facade/langchain/cold-start/tools/process-entity-batch.tool.ts`

---

## Workflow

### Phase 1: Подготовка

1. **Прочитать план миграции** (MIGRATION-PLAN.md)
2. **Прочитать LangGraph Guide** (проверенные паттерны)
3. **Создать TODO** из checklist в плане
4. **Создать структуру папок**:
   ```
   src/facade/langchain/cold-start-v2/
   ├── state.ts
   ├── nodes/
   ├── routers/
   └── cold-start-graph.ts
   ```

### Phase 2: Реализация State и Nodes

**Порядок создания**:

1. `state.ts` — Annotation.Root с полями из плана
2. `nodes/gather-story.ts` — Chat node
3. `nodes/plan-career.ts` — LLM extraction (переиспользуй `planningPrompt`)
4. `nodes/show-plan.ts` — interrupt()
5. `nodes/parse-decision.ts` — structured output → intent
6. `nodes/extract-context.ts` — LLM extraction (переиспользуй логику из process-entity-batch)
7. `nodes/validate-context.ts` — Zod validation
8. `nodes/clarify.ts` — interrupt() для missing fields
9. `nodes/show-context.ts` — interrupt()
10. `nodes/edit-context.ts` — LLM correction
11. `nodes/show-final.ts` — interrupt()
12. `nodes/persist.ts` — Сохранение в DB (переиспользуй логику из confirm-final)
13. `nodes/cancel.ts` — Terminal failed

### Phase 3: Реализация Routers и Graph

1. `routers/decision-router.ts` — детерминированные router functions
2. `cold-start-graph.ts` — сборка StateGraph с nodes и edges
3. `index.ts` — экспорт `ColdStartGraph`

### Phase 4: Проверка T03

1. **Адаптировать T03** для использования cold-start-v2
2. **Запустить один раз** для проверки работоспособности
3. **Запустить 5 раз** для проверки стабильности

---

## Ключевые паттерны (из POC)

### State Definition

```typescript
import { Annotation } from "@langchain/langgraph";

const ColdStartState = Annotation.Root({
  // Replace reducer — новое значение заменяет старое
  phase: Annotation<ColdStartPhase>({
    reducer: (_, y) => y,
    default: () => PHASE.story_gathering,
  }),

  // Append reducer — для массивов
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});
```

### Interrupt Node

```typescript
import { interrupt } from "@langchain/langgraph";

async function showPlanNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const userResponse = interrupt({
    message: "Подтвердите план",
    plan: state.queue,
    options: ["approve", "edit", "cancel"],
  });

  return { userResponse: userResponse as string };
}
```

### Structured Output для Intent

```typescript
// Все поля REQUIRED (не .optional())!
const decisionSchema = z.object({
  intent: z.enum(["approve", "edit", "cancel"]),
  editTarget: z.string(),
  editInstructions: z.string(),
});

const intentParser = model.withStructuredOutput(decisionSchema);

async function parseDecisionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const decision = await intentParser.invoke([
    { role: "system", content: "Parse user intent..." },
    { role: "user", content: state.userResponse },
  ]);

  return { parsedDecision: decision };
}
```

### Router Function (КОД, не LLM!)

```typescript
function routeAfterPlanDecision(state: ColdStartStateType): string {
  switch (state.parsedDecision?.intent) {
    case "approve": return "start_extraction";
    case "edit": return "gather_story";
    case "cancel": return "cancel";
    default: return "show_plan";
  }
}
```

### Conditional Edges

```typescript
const graph = new StateGraph(ColdStartState)
  .addNode("show_plan", showPlanNode)
  .addNode("parse_decision", parseDecisionNode)
  .addNode("start_extraction", startExtractionNode)
  .addNode("gather_story", gatherStoryNode)
  .addNode("cancel", cancelNode)

  .addEdge("show_plan", "parse_decision")
  .addConditionalEdges("parse_decision", routeAfterPlanDecision, {
    start_extraction: "start_extraction",
    gather_story: "gather_story",
    cancel: "cancel",
    show_plan: "show_plan",
  })

  .compile({ checkpointer });
```

---

## Что переиспользовать

| Из | Что | Куда |
|----|-----|------|
| `types.ts` | `ColdStartState`, `ColdStartResponse`, `PHASE` | `state.ts` |
| `prompts.ts` | `planningPrompt()`, `contextExtractionPrompt()` | nodes |
| `response-builders.ts` | `buildAwaitingPlanResponse()` и т.д. | utility |
| `process-entity-batch.tool.ts` | `extractContext()`, `extractAllTrails()` | `extract-context.ts` |

## Что НЕ использовать

- `agent-workflow.ts` — заменяем на StateGraph
- `SYSTEM_PROMPT` (220+ строк) — routing теперь в коде
- `guards.ts` — граф гарантирует фазы
- `sequentialToolCallsMiddleware` — не нужен

---

## Проверка после каждого этапа

```bash
# TypeScript compilation
npx tsc --noEmit

# Lint
npm run lint
```

## Финальная проверка (5 прогонов)

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  OPENROUTER_API_KEY=xxx npx vitest tests/facade/agents/cold-start/integration/happy-path.integration.ts -t "T03" --run
done
```

**Критерий успеха**: 5/5 passed.

---

## Если что-то идёт не так

1. **Structured output fails** → проверь что все поля в Zod schema REQUIRED
2. **Routing неправильный** → проверь router function, добавь console.log
3. **State не обновляется** → проверь reducer (replace vs append)
4. **Interrupt не работает** → убедись что checkpointer подключен

**Debug через LangSmith**:
```bash
LANGSMITH_TRACING=true \
LANGSMITH_PROJECT=waymates-cold-start \
LANGSMITH_API_KEY=xxx \
npx vitest ... -t "T03"
```

---

## Не делай

- ❌ Не модифицируй старый код в `cold-start/`
- ❌ Не используй `.optional()` в Zod schemas для structured output
- ❌ Не полагайся на промпт для routing — только код
- ❌ Не создавай новые types — переиспользуй из `types.ts`
