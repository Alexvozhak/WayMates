# FEAT-029: Unknown Terms Feedback in Search

**Статус:** ✅ DONE
**Приоритет:** P1
**Компонент:** Facade (Normalizer, SearchGraph)
**Создан:** 2025-12-19
**Завершён:** 2025-12-20

---

## Проблема

При поиске пользователь может ввести термин, которого нет в БД (role, position, domain, skill). Текущее поведение:
1. Normalizer не находит термин в словаре
2. Создаётся новый node с `verified: false`
3. Поиск возвращает 0 результатов (никто в БД не помечен этим термином)
4. Пользователь НЕ понимает почему — "молчаливый fail"

## Решение

Разное поведение для разных use cases:

| Use case | Неизвестный термин | Почему |
|----------|-------------------|--------|
| **Cold-start** (upsert) | Silent create | Расширяем БД данными пользователя |
| **Search** | Reject + feedback | Искать бессмысленно, нужен feedback |

### Для Search:
1. Normalizer возвращает `{ normalized, rejected }` (паттерн уже есть для `normalizeReasons`)
2. SearchGraph получает rejected terms
3. Response включает поле `rejectedReasons` / `rejectedFields`
4. UI показывает: "Не нашли в базе: blockchain"

---

## Acceptance Criteria

- [x] `Normalizer.normalizeReasons()` / `normalizeContextFields()` — reject вместо create для неизвестных терминов
- [x] SearchGraph extraction nodes используют strict normalization (`parse-search-intent.ts`, `apply-filters.ts`)
- [x] Response schema включает `rejectedReasons`, `rejectedFields` (`appliedFiltersSchema`, `currentAppliedFiltersSchema`)
- [x] UI (Telegram presenter) показывает feedback о неизвестных терминах (`SearchGraphPresenter`)
- [ ] ~~Предлагает ближайшие matches из словаря (fuzzy suggestions)~~ — P2, не критично для MVP

---

## Implementation Details

**Реализовано в рамках SearchParams Integration (Фаза 2.5):**

1. **Normalizer** (`src/facade/services/normalizer.ts`):
   - `normalizeReasons()` → `{ normalized: string[], rejected: string[] }`
   - `normalizeContextFields()` → `{ normalized: string[], rejected: string[] }`

2. **SearchGraph nodes**:
   - `parse-search-intent.ts` — builds `targetSearchParams.rejectedReasons`
   - `apply-filters.ts` — builds `appliedFilters.rejectedFields`

3. **Schemas** (`src/shared/schemas.ts`):
   - `appliedFiltersSchema.rejectedReasons: z.array(z.string()).nullable()`
   - `currentAppliedFiltersSchema.rejectedFields: z.array(z.string()).nullable()`

4. **Presenter** (`src/telegram-bot/presenters/search-graph-presenter.ts`):
   - Prompt instructs to "Explain filter feedback (applied/rejected) in conversational tone"

---

## Future Enhancements (P2)

- Fuzzy suggestions: когда rejected term показывается с предложениями "может вы имели в виду X, Y, Z?"
- Требует расширения `Normalizer.normalizeTermsStrict()` с `suggestions: Map<string, string[]>`
