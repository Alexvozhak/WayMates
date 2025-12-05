---
description: "Рефакторинг LangGraph миграции: фазы, рудименты, code smells"
allowed-tools: ["Read", "Edit", "Write", "Bash", "TodoWrite", "Glob", "Grep"]
---

# 🔧 Рефакторинг LangGraph миграции

## Цель

Исправить проблемы, выявленные при code review миграции LangGraph.

**Согласованный план**: `/home/alex/.claude/plans/compiled-crafting-lighthouse.md`

**Критерий успеха**: `npm run lint` + `npx tsc --noEmit` + `npm run test:integration` проходят.

---

## Фиксы

### Фикс #1 + #2: Переименовать `saved` → `approved`, добавить `cancelled`

**Причина**:
- `saved` врёт — данные ещё не сохранены, только утверждены
- `cancelled` не должен быть `failed` — это разные сценарии

**Изменения в PHASE**:
```typescript
export const PHASE = {
  extracting: "extracting",
  awaitingConfirmation: "awaiting_confirmation",
  approved: "approved",     // ← было saved
  cancelled: "cancelled",   // ← новая фаза
  failed: "failed",
} as const;
```

**Файлы для каждого графа (upsert-trail, upsert-context, update-context)**:

1. `state.ts`:
   - Изменить `PHASE.saved` → `PHASE.approved`
   - Добавить `PHASE.cancelled`

2. `types.ts`:
   - Обновить response schema: `z.literal("approved")`, добавить `cancelled` вариант

3. `response-builders.ts`:
   - Переименовать ключ `[PHASE.saved]` → `[PHASE.approved]`
   - Добавить builder для `[PHASE.cancelled]`

4. `nodes/persist-*.ts`:
   - Возвращать `phase: PHASE.approved`

5. `nodes/cancel.ts`:
   - Возвращать `phase: PHASE.cancelled` (без validationErrors)

6. `*-graph.ts`:
   - Обновить `interruptValueSchema` с новыми фазами

**MCP Tools**:

7. `src/facade/mcp-server/tools/upsert-context.tool.ts`:
   - Изменить `response.phase === "saved"` → `response.phase === "approved"`

8. `src/facade/mcp-server/tools/update-context.tool.ts`:
   - Изменить `response.phase === "saved"` → `response.phase === "approved"`

---

### Фикс #3: Удалить рудимент `trailCorrectionModel`

**Причина**: Нигде не используется.

**Файл**: `src/facade/langchain/shared-tools/extraction-models.ts`

**Действие**: Удалить экспорт `trailCorrectionModel` (строки с определением).

---

### Фикс #4: Экспортировать Phase тип из state.ts

**Причина**: Тип определяется дважды — в state.ts и response-builders.ts.

**Файлы для каждого графа**:

1. `state.ts` — убедиться что `export type UpsertTrailPhase = ...` экспортируется

2. `response-builders.ts`:
   - Импортировать: `import type { UpsertTrailPhase } from "./state.js";`
   - Удалить локальное определение типа

---

### Фикс #5: Убрать каст в parseDecision

**Причина**: С явным return type каст не нужен.

**Файл**: `src/facade/langchain/shared/decision.ts`

**Было**:
```typescript
export async function parseDecision<T extends ParseDecisionState>(state: T) {
  // ...
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ...
  return { parsedDecision } as Pick<T, "parsedDecision">;
}
```

**Стало**:
```typescript
export async function parseDecision<T extends ParseDecisionState>(
  state: T,
): Promise<Pick<T, "parsedDecision">> {
  // ...
  return { parsedDecision };
}
```

---

### Фикс #6: Убрать fallback в show nodes

**Причина**: Fallback `validatedTrail ?? extractedTrail` никогда не используется — роутер гарантирует наличие данных.

**Файлы**:

1. `src/facade/langchain/upsert-trail/nodes/show-trail.ts`:
   - `trail: validatedTrail ?? extractedTrail` → `trail: validatedTrail!`
   - Убрать `extractedTrail` из деструктуризации если больше не нужен

2. `src/facade/langchain/upsert-context/nodes/show-context.ts`:
   - `context: validatedContext ?? extractedContext` → `context: validatedContext!`

3. `src/facade/langchain/update-context/nodes/show-update.ts`:
   - Аналогично для `mergedContext`

---

## Порядок выполнения

1. **Фикс #1 + #2** — обновить все state.ts, types.ts, response-builders.ts, nodes, tools
2. **Фикс #3** — удалить trailCorrectionModel
3. **Фикс #4** — экспортировать Phase типы
4. **Фикс #5** — убрать каст в parseDecision
5. **Фикс #6** — убрать fallback в show nodes
6. **Проверки**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run test:integration
   ```

---

## Файлы затрагиваемые рефакторингом

### upsert-trail/
- `state.ts`
- `types.ts`
- `response-builders.ts`
- `nodes/persist-trail.ts`
- `nodes/cancel.ts`
- `nodes/show-trail.ts`
- `upsert-trail-graph.ts`

### upsert-context/
- `state.ts`
- `types.ts`
- `response-builders.ts`
- `nodes/persist-context.ts`
- `nodes/cancel.ts`
- `nodes/show-context.ts`
- `upsert-context-graph.ts`

### update-context/
- `state.ts`
- `types.ts`
- `response-builders.ts`
- `nodes/persist-update.ts`
- `nodes/cancel.ts`
- `nodes/show-update.ts`
- `update-context-graph.ts`

### shared/
- `decision.ts`

### shared-tools/
- `extraction-models.ts`

### mcp-server/tools/
- `upsert-context.tool.ts`
- `update-context.tool.ts`

---

## Не делаем (согласовано)

- ❌ BaseGraphRunner — излишняя абстракция
- ❌ Фабрики для cancel/persist/routers — оставляем явный код
- ❌ Перенос нормализации из Tools в графы — консистентно с cold-start
- ❌ Рефакторинг intentParser в cold-start-v2 — отложено

---

## Проверка после каждого этапа

```bash
# TypeScript compilation
npx tsc --noEmit

# Lint
npm run lint
```

## Финальная проверка

```bash
npm run test:integration
```

ARGUMENTS: $ARGUMENTS
