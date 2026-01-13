# /refactor-career-collector

Рефакторинг Career Collector Agent на LangChain v1.0 с Hybrid Routing.

## Контекст

Реализуй согласованный план с hybrid routing архитектурой.

**Обязательно прочитай перед работой:**
1. `/home/alex/.claude/plans/foamy-singing-dove.md` - согласованный план с hybrid routing (1А+2А+3С)
2. `docs/architecture/decisions/ADR-015-langchain-atomic-tools-pattern.md` - архитектурное решение
3. `.claude/routers/langchain/router.md` - atomic tools vs orchestrator
4. `.claude/routers/langchain/middleware.md` - humanInTheLoopMiddleware

---

## Ключевая архитектура: Hybrid Routing

**Deterministic goto для business logic:**
- Validation failed → goto "ask_clarification"
- Validation success → goto "confirm_career_data"
- Save complete → goto END

**LLM reasoning для user intent:**
- Cancel detection (в любой момент)
- Confirmation intent (confirm vs correction)
- Clarification answers handling

---

## Задачи

### 1. Разбить orchestrator на 4 atomic tools

**Файл:** `src/facade/langchain/career-collector-agent.ts`

**Было:** `createExtractCareerDataTool` - один tool делает всё

**Будет:** 4 atomic tools:

```typescript
// 1. extract_user_context - parse + validate + normalize
//    Returns: Command with goto (deterministic routing)
//    - Validation failed → goto "ask_clarification"
//    - Validation success → goto "confirm_career_data"

// 2. ask_clarification - показать вопросы
//    Returns: Command with status update (NO goto!)
//    - Agent interprets user response (answers OR cancel)

// 3. confirm_career_data - показать preview
//    Returns: Command with status update (NO goto!)
//    - Agent interprets user response (confirm OR correct OR cancel)

// 4. save_career_data - сохранить в Neo4j
//    Returns: Command with goto END (deterministic)
```

**Требования к extract_user_context:**
- Читает `partialContext` и `clarificationRound` из `config.state`
- Merges с previous partial (если clarification round)
- Max rounds check (`LANGCHAIN_MAX_CLARIFICATION_ROUNDS=3`)
- Normalization после успешной validation
- Deterministic goto для routing

**Требования к ask_clarification:**
- ❌ NO goto (Agent decides next)
- ✅ Returns status + message

**Требования к confirm_career_data:**
- ❌ NO goto (Agent decides next)
- ✅ Returns status + contexts + message

**Требования к save_career_data:**
- Reads contexts/trails from `config.state` (NO parameters!)
- Deterministic goto END

---

### 2. Обновить system prompt (КРИТИЧНО!)

**Файл:** `src/facade/langchain/career-collector-agent.ts`

**Используй system prompt из плана** (секция "System Prompt (CRITICAL)"):

```typescript
systemPrompt: `You are a career history extraction assistant.

WORKFLOW (Hybrid Routing):
1. User provides career text → call extract_user_context
2. Tool routes via goto:
   - Validation failed → ask_clarification (deterministic)
   - Validation success → confirm_career_data (deterministic)
3. After interrupt resume → YOU decide next step (see below)

YOUR ROLE: Interpret user intent + follow tool routing

═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
1. Respond: "Workflow cancelled. Your data was not saved."
2. DO NOT call any tools
3. Stop workflow

Examples:
- User: "cancel" → YOU: "Workflow cancelled."
- User: "stop this" → YOU: "Workflow cancelled."

═══════════════════════════════════════════════════
AFTER CLARIFICATION (status="awaiting_clarification")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CANCEL intent:
   - Keywords: "cancel", "stop", "quit", "abort"
   - Action: Cancel workflow (see above)

2. ANSWERS intent:
   - User provides answers to questions
   - Action: Call extract_user_context with their answers

Examples:
- User: "Python, React, Tech startup" → Call extract_user_context
- User: "cancel this" → Cancel workflow

═══════════════════════════════════════════════════
AFTER CONFIRMATION (status="awaiting_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM intent:
   - Keywords: "yes", "да", "ok", "correct", "good", "looks good", "👍"
   - Action: Call save_career_data

2. CORRECTION intent:
   - User provides changes: "change X to Y", "update position", etc.
   - Action: Call extract_user_context with correction text

3. CANCEL intent:
   - Keywords: "cancel", "stop"
   - Action: Cancel workflow (see above)

Examples:
- User: "yes" → Call save_career_data
- User: "looks good" → Call save_career_data
- User: "change position to Senior Engineer" → Call extract_user_context
- User: "cancel" → Cancel workflow

═══════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════

1. ALWAYS follow tool goto routing (deterministic business logic)
2. Interpret user intent through natural language (cancel, confirm, correct)
3. When in doubt about intent:
   - Clarification context → treat as answers
   - Confirmation context → treat as correction (safe default)
4. DO NOT generate your own questions - tools handle that
5. DO NOT parse/validate data yourself - tools handle that

Your job: Relay messages to tools + interpret user intent + display results.
`
```

---

### 3. Добавить humanInTheLoopMiddleware

**Файл:** `src/facade/langchain/career-collector-agent.ts`

```typescript
import { humanInTheLoopMiddleware } from "langchain";

return createAgent({
  model,
  tools: [
    createExtractUserContextTool(deps),
    askClarificationTool,
    confirmDataTool,
    createSaveCareerDataTool(deps),
  ],
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        ask_clarification: true,
        confirm_data: true,
      },
    }),
  ],
  checkpointer: postgresService.getCheckpointer(),
  stateSchema,
  systemPrompt, // ← Detailed prompt above
});
```

---

### 4. Обновить ColdStartTool (УПРОСТИТЬ!)

**Файл:** `src/facade/tools/cold-start.tool.ts`

**БЫЛО:** Manual intent classification, special commands

**СТАЛО:** Simple pass-through (Agent handles intent)

```typescript
// ✅ Simple pass-through pattern
while (result.status !== "complete" && result.status !== "failed") {
  if (result.status === "awaiting_clarification") {
    const userAnswers = await getUserInput();

    // Agent interprets: answers OR cancel
    result = await collectContexts(userAnswers, threadId, deps);
  }

  if (result.status === "awaiting_confirmation") {
    const userResponse = await getUserInput();

    // Agent interprets: confirm OR correction OR cancel
    result = await collectContexts(userResponse, threadId, deps);
  }
}

// Check final status
if (result.status === "complete") {
  return result.contexts;
} else if (result.status === "failed") {
  throw new Error("Workflow failed: " + result.message);
} else {
  throw new Error("Workflow cancelled or stopped");
}
```

**Optional:** Add retry logic for cancel detection fallback (см. план секцию "Risk 1")

---

### 5. Обновить stateSchema

**Файл:** `src/facade/langchain/career-collector-agent.ts`

**Добавить:**
```typescript
const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,

  // Data collection
  partialContext: userContextSchemaPartial.optional(), // ✅ KEEP!
  contexts: z.array(userContextSchema).optional(),
  trails: z.array(trailSchema).optional(),

  // Status tracking
  status: z.enum([
    "collecting",
    "awaiting_clarification",
    "awaiting_confirmation",
    "complete",
    "failed", // NEW!
  ]).optional(),

  message: z.string().optional(),

  // NEW: Clarification round counter
  clarificationRound: z.number().default(0),

  // User context
  userId: z.string(),
});
```

---

### 6. Обновить shared-tools (проверка)

**Проверь:**
- `shared-tools/ask-clarification.tool.ts` - должен НЕ использовать goto
- `shared-tools/confirm-data.tool.ts` - должен НЕ использовать goto

**Эти tools НЕ должны иметь goto** - Agent decides next step через LLM reasoning.

---

### 7. Добавить ENV config

**Файл:** `.env`

```bash
# Max clarification rounds before giving up
LANGCHAIN_MAX_CLARIFICATION_ROUNDS=3
```

---

## Порядок выполнения

1. ✅ Прочитать план `/home/alex/.claude/plans/foamy-singing-dove.md`
2. ⏳ Обновить `extract_user_context` tool (add clarificationRound, max rounds, goto)
3. ⏳ Создать `save_career_data` tool (read from state, goto END)
4. ⏳ Обновить system prompt (detailed hybrid routing prompt)
5. ⏳ Добавить `humanInTheLoopMiddleware`
6. ⏳ Упростить ColdStartTool (remove intent classification)
7. ⏳ Обновить stateSchema (add clarificationRound, failed status)
8. ⏳ Проверить shared-tools (no goto)
9. ⏳ Добавить ENV config
10. ⏳ Запустить `npm run lint:fix` + `npx tsc --noEmit`
11. ⏳ Запустить тесты

---

## Качественные критерии

**MUST:**
- ✅ Deterministic goto для business logic (validation, finalization)
- ✅ LLM reasoning для user intent (cancel, confirm, correct)
- ✅ NO special commands (Agent reasoning handles intent)
- ✅ NO manual intent classification outside agent
- ✅ humanInTheLoopMiddleware настроен
- ✅ Lint + TypeScript compilation проходят

**SHOULD:**
- ✅ Cancel detection works (explicit examples in prompt)
- ✅ Confirmation intent works (keywords + safe default)
- ✅ Max rounds limit prevents infinite loops
- ✅ Re-confirm after correction (always)

**MUST NOT:**
- ❌ Special commands ("SAVE_CONFIRMED_DATA")
- ❌ Manual intent classification в ColdStartTool
- ❌ goto в interrupt tools (ask_clarification, confirm_data)
- ❌ Implicit business logic routing (всегда goto)

---

## Референсы

- **План:** `/home/alex/.claude/plans/foamy-singing-dove.md` (полный workflow + examples)
- **ADR:** `docs/architecture/decisions/ADR-015-langchain-atomic-tools-pattern.md`
- **Документация:** `.claude/routers/langchain/` (router.md, middleware.md)

---

## Success Criteria

**Agent должен уметь:**
1. ✅ Detect "cancel" на любом этапе workflow
2. ✅ Interpret "yes"/"ok" как confirmation
3. ✅ Interpret changes как correction
4. ✅ Re-confirm после correction
5. ✅ Stop после max clarification rounds

**Workflow должен быть:**
1. ✅ Deterministic для business logic (validation routing)
2. ✅ Flexible для user intent (natural language)
3. ✅ Production-ready (predictable critical paths)
4. ✅ Testable (unit test business logic, integration test full flow)
