# Рефакторинг: Централизованный reasoning для LLM extraction

**Component**: facade/langGraph
**Priority**: 🟡 P1 (улучшение качества + debugging)

---

## Мотивация

При отладке extraction (cold-start, search-graph) сложно понять почему LLM извлёк неправильные данные. Reasoning (chain of thought) заставляет LLM "думать" перед ответом и логирует объяснение.

**Профит:**
- Качество extraction +10-30% (chain of thought)
- Debugging: видим в логах почему LLM так решил
- Консистентность: один паттерн везде

---

## AS IS

**Схемы С reasoning (2 шт):**
```typescript
// cold-start-v2/types.ts
decisionSchema = z.object({
  reasoning: z.string().describe("Brief explanation..."),
  intent: z.enum([...]),
  ...
});

// search-graph/nodes/parse-intent.ts
intentWithFiltersSchema = z.object({
  parsed: z.discriminatedUnion("intent", [
    z.object({ intent: z.literal("validate"), reasoning: z.string(), ... }),
    ...
  ])
});
```

**Схемы БЕЗ reasoning (7 шт, 18 мест использования):**
- `extractableContextSchema` — 6 мест
- `extractableTrailSchema` — 4 места
- `targetContextSchema` — 2 места
- `adhocContextBase` — 1 место
- `planOutputSchema` — 1 место
- `advisorIntentSchema` — 1 место
- `linkTrailSchema` — 1 место

**Проблема:** Reasoning не везде, нет централизованного логирования.

---

## TO BE

### 1. Утилиты (llm-schemas.ts)

```typescript
/**
 * Оборачивает схему добавляя reasoning поле.
 * LLM сначала пишет reasoning, потом заполняет остальные поля.
 */
export function withReasoning<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  describe = "Explain your extraction step by step"
): z.ZodObject<...> {
  return z.object({
    reasoning: z.string().describe(describe),
    ...schema.shape
  });
}

/**
 * Извлекает data из результата с reasoning, логирует reasoning.
 * Возвращает data без reasoning (не попадает в response).
 */
export function stripReasoning<T extends { reasoning: string }>(
  result: T,
  logger: Logger,
  context: string
): Omit<T, "reasoning"> {
  const { reasoning, ...data } = result;
  logger.info({ reasoning }, `${context} reasoning`);
  return data;
}
```

### 2. Использование в nodes

```typescript
// До:
const schema = extractableContextSchema;
const result = await model.withStructuredOutput(schema).invoke(...);
return { pendingContext: result };

// После:
const schema = withReasoning(extractableContextSchema, "Explain what you extracted");
const result = await model.withStructuredOutput(schema).invoke(...);
const data = stripReasoning(result, logger, "context extraction");
return { pendingContext: data };
```

### 3. Адаптация существующих схем

**decisionSchema** — рефакторить для консистентности:
```typescript
// До (inline reasoning):
const decisionSchema = z.object({
  reasoning: z.string(),
  intent: z.enum([...]),
});

// После (через утилиту):
const decisionSchemaBase = z.object({
  intent: z.enum([...]),
  editTarget: z.string(),
  editInstructions: z.string(),
});
const decisionSchema = withReasoning(decisionSchemaBase, "Explain why this intent");
```

**intentWithFiltersSchema** — сложнее (discriminatedUnion), можно оставить как есть или вынести reasoning наружу.

---

## План реализации

### Этап 1: Утилиты (~25 LOC)
- [ ] Добавить `withReasoning()` в `src/facade/utils/llm-schemas.ts`
- [ ] Добавить `stripReasoning()` там же
- [ ] Экспортировать из index

### Этап 2: Новые схемы (~50 LOC, 14 мест)
- [ ] `planOutputSchema` (plan-career.ts) — для salary в preview
- [ ] `extractableContextSchema` (6 мест)
- [ ] `extractableTrailSchema` (4 мест)
- [ ] `targetContextSchema` (2 места)
- [ ] `adhocContextBase` (1 место)

### Этап 3: Мелкие схемы (~15 LOC, 3 места)
- [ ] `advisorIntentSchema`
- [ ] `linkTrailSchema`

### Этап 4: Консистентность существующих (~20 LOC, опционально)
- [ ] `decisionSchema` — рефакторить через withReasoning
- [ ] `intentWithFiltersSchema` — оценить целесообразность

---

## Acceptance Criteria

- [ ] AC1: `withReasoning()` работает с `z.object()` и результатом `makeNullable()`
- [ ] AC2: Reasoning логируется через pino (видно в docker logs)
- [ ] AC3: Reasoning НЕ попадает в response клиенту
- [ ] AC4: Batch тест `feat-053-salary-feedback.yaml` проходит
- [ ] AC5: Существующие тесты не сломаны

---

## Риски

| Риск | Митигация |
|------|-----------|
| TypeScript типы сложные | Использовать `as any` в крайнем случае, типы не критичны для runtime |
| LLM игнорирует reasoning | Добавить в prompt "You MUST fill reasoning first" |
| Увеличение latency | Minimal (~50-100 tokens), перекрывается качеством |

---

## Оценка

- **LOC**: ~100
- **Время**: 30-60 минут
- **Файлы**: ~20

---

## Implementation Notes

**Date**: TBD
**Status**: PLANNED
**Commit**: TBD
