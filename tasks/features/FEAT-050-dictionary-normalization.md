# FEAT: Dictionary Normalization в Cold-Start

**Статус:** DONE ✅ (2025-12-29)
**Приоритет:** P1
**Компонент:** cold-start-v2
**Оценка:** ~50 LOC (Normalizer уже есть, перенос + diff + edit logic)

---

## Перед началом — прочитать

| Файл | Зачем |
|------|-------|
| `src/facade/services/normalizer.ts` | Как работает нормализация, fuzzy match, addTerm |
| `src/facade/langGraph/cold-start-v2/nodes/extract-context.ts` | Куда добавить вызов Normalizer |
| `src/facade/langGraph/cold-start-v2/nodes/persist.ts` | Откуда убрать дубль normalize |
| `src/facade/langGraph/cold-start-v2/nodes/edit-context.ts` | Куда добавить логику "верни как было" |
| `src/facade/langGraph/cold-start-v2/state.ts` | Структура state, куда добавить normalizations |
| `src/facade/langGraph/cold-start-v2/response-builders.ts` | Как передаются данные в response |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | contextCorrectionPrompt для edit |
| `src/cypher/queries/dictionaries.ts` | MERGE логика для dedup |

---

## Проблема

При extraction контекста LLM может извлечь значения, которых нет в словаре:
- Position: "grade-2" (вместо junior/middle)
- Domain: "research-and-development" (нет в словаре)
- Skills: "team-leadership" (нет в словаре)

Сейчас эти значения молча сохраняются. Пользователь не знает что его "Grade 2" заменён на "junior".

---

## Решение

### Структурные поля (STRICT): Position, Role, Domain, Industry

1. Используем существующий `Normalizer.normalizeFullContext()`
2. Сравниваем до/после → собираем diff
3. На confirmation показываем diff в компактном формате
4. Если пользователь говорит "верни [поле]" → добавляем original как unverified

### Skills (AUTO-ADD)

1. `Normalizer.normalizeTerm()` уже делает: exact → fuzzy → INSERT unverified
2. MERGE в Cypher гарантирует один entry на canonicalName
3. Пользователю не показываем замены для skills

---

## Существующая инфраструктура

**Normalizer** (`src/facade/services/normalizer.ts`):
- `normalizeFullContext()` — нормализует все поля контекста
- `normalizeTerm()` — exact match → fuzzy LLM → INSERT unverified
- Уже добавляет unverified terms с `createdBy: userId`

**Cypher** (`src/cypher/queries/dictionaries.ts`):
- `MERGE (t:Skill {canonicalName: $canonicalName})` — dedup

**Промпт** уже содержит dictHints + "map to KNOWN values".

---

## План реализации

### 1. State — добавить normalizations

**Файл:** `src/facade/langGraph/cold-start-v2/state.ts`

```typescript
normalizations: Annotation<Array<{
  field: "position" | "role" | "domain" | "industry";
  original: string;
  normalized: string;
}>>
```

### 2. extract-context.ts — использовать Normalizer + собрать diff

**Файл:** `src/facade/langGraph/cold-start-v2/nodes/extract-context.ts`

```typescript
// После extraction
const before = { ...extracted };
const normalized = await normalizer.normalizeFullContext(extracted, userId);
const normalizations = collectNormalizations(before, normalized);

return { pendingContext: normalized, normalizations };
```

### 3. Response builders — передавать normalizations

**Файл:** `src/facade/langGraph/cold-start-v2/response-builders.ts`

```typescript
// awaiting_context_confirmation
{ entity: pendingContext, normalizations: state.normalizations }
```

### 4. NLP prompt — компактный формат diff

**Файл:** `src/facade/services/nlp-formatter/prompts.ts`

```
📍 Position 1/2

Role: developer
Position: junior
Domain: backend
Skills: python, typescript, team-leadership

⚠️ Нормализовано:
  • Position: "Grade 2" → junior
  • Domain: "R&D" → backend

Подтвердить? Или скажите что вернуть.
```

**Важно:** Skills НЕ показываем в diff (добавляются втихую как unverified).

### 5. edit-context.ts — логика "верни как было"

**Файл:** `src/facade/langGraph/cold-start-v2/nodes/edit-context.ts`

1. Передать `normalizations` в `contextCorrectionPrompt`
2. LLM определяет: хочет original или другое значение
3. Если original → вызвать addTerm:

```typescript
if (wantsOriginal && normalization) {
  await coreClient.client.dictionaries.addTerm.mutate({
    type: normalization.field,
    canonicalName: toKebabCase(normalization.original),
    verified: false,
    createdBy: userId
  });
  // Использовать original в контексте
}
```

### 6. persist.ts — убрать дубль

**Файл:** `src/facade/langGraph/cold-start-v2/nodes/persist.ts`

Убрать вызов `normalizerService.normalizeFullContext()` — нормализация уже произошла в extract-context.

### 7. Schemas — обновить response types

**Файл:** `src/shared/schemas.ts`

Добавить `normalizations` в confirmation response schema.

---

## Acceptance Criteria

- [ ] Position/Role/Domain/Industry нормализуются через Normalizer
- [ ] Diff собирается сравнением до/после нормализации
- [ ] На confirmation показывается компактный diff
- [ ] "верни [поле]" → создаётся unverified term с original value
- [ ] Skills автоматически добавляются как unverified (существующая логика)
- [ ] MERGE гарантирует один entry на canonicalName
