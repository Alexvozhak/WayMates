# FEAT-042: Нормализация Kaggle Import

**Status**: DONE
**Priority**: P0
**Completed**: 2025-12-25
**Component**: Core (import, dictionaries)
**Created**: 2025-12-25

---

## Проблема

При импорте Kaggle данных поля **не нормализуются** к каноническим значениям из словарей:

| Поле | Ожидается | Импортировано |
|------|-----------|---------------|
| Position | `"senior"`, `"middle"`, `"junior"` | `"Sr. Database Administrator"`, `"Senior Java Developer"` |
| Role | `"developer"`, `"dba"` | Частично нормализовано |
| Skills | lowercase, normalized | `"TypeScript"` vs `"typescript"` (case mismatch) |

**Результат:**
- `search.adhoc` с `position: "middle"` → 0 кандидатов
- `search.byTarget` с `goal.position: "senior"` → 0 кандидатов
- Skills matching работает только при точном совпадении case

---

## Найденные несоответствия

### 1. Position как сырые названия должностей

```cypher
// Сейчас: 1314 contexts связаны с Position нодами типа:
"Sr. Database Administrator" (42 contexts)
"Oracle Database Administrator" (27 contexts)
"Java Developer" (24 contexts)

// Должно быть: связь с каноническими Position
"senior" (N contexts)
"middle" (N contexts)
"junior" (N contexts)
```

### 2. Нет извлечения грейда из названия

Название `"Sr. Database Administrator"` должно парситься:
- Position: `"senior"` (из "Sr.")
- Role: `"dba"` (из "Database Administrator")

### 3. Case sensitivity в Skills

```cypher
// Сейчас:
["TypeScript", "JavaScript", "HTML"]

// Должно быть (lowercase):
["typescript", "javascript", "html"]
```

### 4. Domains правильно (но проверить)

Domains уже нормализованы (`backend`, `frontend`, `devops`), но нужно проверить полноту.

---

## Требования

### Acceptance Criteria

1. **Position нормализация**
   - [x] Парсить грейд из job title (Sr., Senior, Jr., Junior, Lead, etc.)
   - [x] Интерполяция по траектории (junior→...→senior = middle между)
   - [x] Связывать Context с каноническими Position нодами

2. **Skills lowercase**
   - [x] Все skills в lowercase

3. **CreationReason нормализация**
   - [x] Первый context → `["started_working"]`
   - [x] Остальные → вычисление по изменениям (position, location, industry, domain)
   - [x] Если ничего не изменилось → `["company_changed"]`

4. **Import script update**
   - [x] `scripts/normalize-kaggle-data.ts` — новый скрипт нормализации
   - [x] Re-import с нормализованными данными

5. **Проверка**
   - [x] `position: "middle"` → 622 contexts
   - [x] `position: "senior"` → 599 contexts
   - [x] Skills в lowercase (0 mixed-case)
   - [x] CreationReasons корректные (225 started_working)

---

## Технический подход

### Вариант A: Re-import (рекомендуется)

1. Обновить `scripts/import-kaggle.ts`:
   - Добавить `normalizePosition(jobTitle)` → canonical position
   - Добавить `extractRoleFromTitle(jobTitle)` → canonical role
   - Lowercase все skills
   - Сохранять `originalJobTitle` для display

2. Удалить старые данные и импортировать заново

### Вариант B: Migration script

1. Создать `scripts/migrate-kaggle-positions.ts`
2. Для каждого Context:
   - Парсить Position.canonicalName → извлечь грейд
   - Создать связь с правильной Position нодой
   - Обновить skills на lowercase

---

## Парсинг грейда из job title

```typescript
function extractPositionFromTitle(title: string): string | null {
  const lower = title.toLowerCase();

  // Senior indicators
  if (lower.startsWith('sr.') || lower.startsWith('sr ') ||
      lower.includes('senior') || lower.includes('lead') ||
      lower.includes('principal') || lower.includes('staff')) {
    return 'senior';
  }

  // Junior indicators
  if (lower.startsWith('jr.') || lower.startsWith('jr ') ||
      lower.includes('junior') || lower.includes('intern') ||
      lower.includes('entry') || lower.includes('associate')) {
    return 'junior';
  }

  // Default to middle if developer/engineer/admin without level
  if (lower.includes('developer') || lower.includes('engineer') ||
      lower.includes('administrator') || lower.includes('analyst')) {
    return 'middle';
  }

  return null;
}
```

---

## Связанные файлы

- `scripts/import-kaggle.ts` — основной скрипт импорта
- `src/shared/dictionaries.ts` — канонические значения
- `src/core/normalizer.service.ts` — нормализация значений

---

## Оценка

| Аспект | Оценка |
|--------|--------|
| Сложность | Средняя (парсинг + re-import) |
| Риск | Низкий (можно откатить на backup) |
| Влияние | Высокое (без этого поиск не работает) |

---

## Зависимости

- Фаза 6 (Kaggle Import) — уже DONE, нужен fix
- Dictionary service — уже есть канонические значения

---

## Notes

Обнаружено во время manual testing сессии 2025-12-25.
Без этого фикса поиск по position не работает — критично для MVP.
