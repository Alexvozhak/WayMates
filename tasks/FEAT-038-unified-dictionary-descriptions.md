# FEAT-038: Унификация словарей с descriptions

**Статус:** READY_FOR_WORK
**Приоритет:** P1
**Оценка:** ~100 LOC

---

## Проблема

Промпты написаны для LLM ("как извлекать"), а не для пользователя ("что можно указать"):

1. **Cold-Start** не спрашивает: educationLevel, salary, birthYear, companySize, feedback
2. **Search** показывает `company_changed` вместо "Employer or organization changed"
3. **Фильтры** (excludedContextFields, recencyThresholdMonths) не объяснены

**Причина:** Словари возвращают только `canonicalName`, без `description`.

---

## Решение

Унифицировать все словари до формата `{ canonicalName, description }`:

- Reasons: description = семантическое объяснение
- Positions: description = human-readable название ("team_lead" → "team lead")
- Остальные: description = display name (fallback на canonicalName)

---

## Текущее состояние

| Словарь | JSON формат | Neo4j description | Cypher возвращает |
|---------|-------------|-------------------|-------------------|
| reasons | `{ canonical: description }` | ✅ Есть | ❌ Нет |
| positions | `{ canonical: display_name }` | ❌ Нет | ❌ Нет |
| roles | `{ canonical: same }` | ❌ Нет | ❌ Нет |
| domains | `{ canonical: same }` | ❌ Нет | ❌ Нет |

---

## План реализации

### Фаза 1: Database (import scripts)

**Файлы:**
- `database/import-positions.ts`
- `database/import-roles.ts`
- `database/import-domains.ts`

**Изменения:**
```typescript
// БЫЛО
const IMPORT_POSITIONS_QUERY = `
  UNWIND $positions AS canonicalName
  MERGE (p:Position {canonicalName: canonicalName})
  SET p.verified = true, ...
`;
const positions = Object.values(positionsData);

// СТАЛО
const IMPORT_POSITIONS_QUERY = `
  UNWIND $positions AS pos
  MERGE (p:Position {canonicalName: pos.canonicalName})
  SET p.description = pos.description,
      p.verified = true, ...
`;
const positions = Object.entries(positionsData).map(([canonicalName, description]) => ({
  canonicalName,
  description,
}));
```

**LOC:** ~30

---

### Фаза 2: Cypher Query

**Файл:** `src/cypher/queries/dictionaries.ts`

**Изменения:**
```typescript
// БЫЛО
collect(p.canonicalName) AS positions

// СТАЛО
collect({
  canonicalName: p.canonicalName,
  description: coalesce(p.description, p.canonicalName)
}) AS positions
```

**LOC:** ~20

---

### Фаза 3: Schema

**Файл:** `src/shared/schemas.ts`

**Изменения:**
```typescript
// Новый тип
export const dictionaryEntrySchema = z.object({
  canonicalName: z.string(),
  description: z.string(),
});

export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>;

// Обновить dictionariesSchema
export const dictionariesSchema = z.object({
  skill: z.array(dictionaryEntrySchema),
  position: z.array(dictionaryEntrySchema),
  // ...
  reasons: z.array(dictionaryEntrySchema),
});
```

**LOC:** ~15

---

### Фаза 4: Facade DictionariesCache

**Файл:** `src/facade/services/dictionaries-cache.ts`

**Изменения:**
```typescript
// БЫЛО
async getSimple(type: SimpleDictionaryType): Promise<Map<string, string>> {
  return new Map(items.map((name) => [name.toLowerCase(), name]));
}

// СТАЛО
async getSimple(type: SimpleDictionaryType): Promise<Map<string, DictionaryEntry>> {
  return new Map(items.map((entry) => [entry.canonicalName.toLowerCase(), entry]));
}
```

**LOC:** ~15

---

### Фаза 5: NlpFormatter Prompts

**Файл:** `src/facade/services/nlp-formatter/prompts.ts`

**Изменения:**
- Добавить `{reasonsHint}` placeholder в SEARCH_PROMPT
- Инструкция показывать reasons с descriptions

**LOC:** ~20

---

## Type Schema

```typescript
// === REUSED TYPES ===
import { z } from "zod";

// === NEW TYPES ===
export const dictionaryEntrySchema = z.object({
  canonicalName: z.string(),
  description: z.string(),
});

export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>;

// === MODIFIED TYPES ===
export const dictionariesSchema = z.object({
  skill: z.array(dictionaryEntrySchema),
  position: z.array(dictionaryEntrySchema),
  role: z.array(dictionaryEntrySchema),
  domain: z.array(dictionaryEntrySchema),
  city: z.array(dictionaryEntrySchema),
  industry: z.array(dictionaryEntrySchema),
  platform: z.array(dictionaryEntrySchema),
  language: z.array(dictionaryEntrySchema),
  reasons: z.array(dictionaryEntrySchema),
});
```

---

## Acceptance Criteria

1. ✅ Все import-*.ts записывают description в Neo4j
2. ✅ Cypher query возвращает `{ canonicalName, description }`
3. ✅ dictionariesSchema использует dictionaryEntrySchema
4. ✅ DictionariesCache работает с новым типом
5. ✅ NlpFormatter показывает reason descriptions в Search
6. ✅ lint + tsc проходят
7. ✅ Существующие тесты проходят

---

## Миграция данных

После реализации нужно перезапустить import скрипты:

```bash
npx tsx database/import-positions.ts
npx tsx database/import-roles.ts
npx tsx database/import-domains.ts
# reasons уже имеют description
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| Breaking change для потребителей | Проверить все использования через grep |
| Тесты падают | Обновить fixtures/mocks |
| Production data | Миграция через import scripts |

---

## Зависимости

- Нет внешних зависимостей
- Использует существующие JSON файлы
