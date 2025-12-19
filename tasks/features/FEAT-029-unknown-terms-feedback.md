# FEAT-029: Unknown Terms Feedback in Search

**Статус:** PENDING
**Приоритет:** P1
**Компонент:** Facade (Normalizer, SearchGraph)
**Создан:** 2025-12-19

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
3. Response включает поле `unknownTerms: string[]`
4. UI показывает: "Не нашли в базе: blockchain. Попробуйте: backend, data-engineering"

---

## Acceptance Criteria

- [ ] `Normalizer.normalizeTermStrict()` — reject вместо create для неизвестных терминов
- [ ] SearchGraph extraction nodes используют strict normalization
- [ ] Response schema включает `unknownTerms?: string[]`
- [ ] UI (Telegram presenter) показывает feedback о неизвестных терминах
- [ ] Предлагает ближайшие matches из словаря (fuzzy suggestions)

---

## Technical Notes

Существующий паттерн в `normalizer.ts`:
```typescript
async normalizeReasons(userInput: string[]): Promise<NormalizeReasonsResult> {
  // Returns { normalized: string[], rejected: string[] }
}
```

Нужно аналогичный для simple dictionaries:
```typescript
async normalizeTermsStrict(type: SimpleDictionaryType, values: string[]): Promise<{
  normalized: string[];
  rejected: string[];
  suggestions: Map<string, string[]>;  // rejected term → closest matches
}>;
```

---

## Estimate

~4-6 часов:
- Normalizer strict methods: 2h
- SearchGraph integration: 1h
- Response schema + presenter: 1h
- Tests: 1-2h
