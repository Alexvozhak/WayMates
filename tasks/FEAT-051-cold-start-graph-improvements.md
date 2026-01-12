# FEAT-051: Cold-Start Graph UX Improvements

**Статус:** DONE
**Приоритет:** P1
**Закрыт:** 2025-12-29
**Компонент:** cold-start-v2
**Создан:** 2025-12-29 (из анализа сессии FEAT-050)

---

## Резюме

Cold-start граф **функционально работает**, но имеет значительные UX и архитектурные проблемы, которые могут привести к фрустрации пользователей и высокому churn rate.

**Оценка:** 6/10 — работает, но требует доработки перед production.

---

## Что работает хорошо

### 1. Архитектура LangGraph
- Чёткое разделение на nodes с single responsibility
- withLogging wrapper для observability
- Dependency injection через GraphDeps
- State management через Annotations

### 2. Нормализация (FEAT-050)
- STRICT поля нормализуются корректно
- Diff показывается пользователю
- Revert flow позволяет вернуть original value

### 3. Validation flow
- Чёткое разделение required/optional полей
- MAX_CLARIFICATION_ROUNDS предотвращает бесконечные циклы
- Missing fields группируются в батчи

---

## Критические проблемы

### 🔴 P0: Слишком много required полей

**Проблема:**
UserContext требует 9+ обязательных полей:
- position, role, domains, skills, industry
- countryCode, cityName, citizenships
- creationReason

**Последствия:**
- Короткая story = 3-5 раундов clarification
- Пользователь чувствует себя на допросе
- Высокий drop-off rate

**Рекомендация:**
```
Сделать часть полей опциональными с умными defaults:
- citizenships → default from countryCode
- cityName → nullable (только страна обязательна)
- industry → "technology" default для IT ролей
- creationReason → infer from context order
```

### 🔴 P0: Extraction prompt не извлекает implicit информацию

**Проблема:**
LLM строго следует "Extract ONLY explicitly mentioned information", что приводит к null для полей которые можно вывести.

**Пример:**
```
User: "Работал backend разработчиком в Москве"
LLM: countryCode = null (не сказано "Россия" явно)
     citizenships = null
     industry = null
```

**Рекомендация:**
```
Добавить inference rules в prompt:
- Москва/СПб → countryCode = "RU", citizenships = ["RU"]
- "backend разработчик" → industry = "technology"
- Первая позиция → creationReason = ["started_working"]
```

### 🟡 P1: Clarification UX неоптимален

**Проблема:**
- Каждый missing field = отдельный вопрос
- Нет группировки связанных полей
- Нет прогресс-индикатора "осталось 3 поля"

**Рекомендация:**
```
Группировать поля:
- Location: "В каком городе и стране работал?"
- Role details: "Какая отрасль? Размер компании?"
- Показывать прогресс: "📊 Заполнено 6/9 полей"
```

### 🟡 P1: Нет возможности пропустить optional поля

**Проблема:**
После заполнения required, система предлагает optional поля, но нет явного способа сказать "пропустить всё".

**Рекомендация:**
```
Добавить явные кнопки/команды:
- "пропустить" / "skip"
- "сохранить как есть"
```

---

## Архитектурные замечания

### State bloat

`ColdStartState` содержит 17+ полей, многие из которых нужны только в определённых фазах:

```typescript
// Используется только в extraction
pendingContext, pendingTrails

// Используется только в clarification
missingFields, optionalFields, clarificationRound

// Используется только в confirmation
normalizations, currentEntityContext
```

**Рекомендация:** Рассмотреть phase-specific state или cleanup после фаз.

### Двойная роль normalizations

`normalizations` используется для:
1. Показа diff пользователю
2. Логики revert в edit-context

Это coupling — изменение формата для UI сломает revert logic.

**Рекомендация:** Разделить на `normalizationsForDisplay` и internal tracking.

---

## Метрики для мониторинга

После production launch отслеживать:

| Метрика | Target | Алерт |
|---------|--------|-------|
| Clarification rounds per user | < 2 | > 4 |
| Drop-off после 3+ clarifications | < 20% | > 40% |
| Time to saved | < 3 min | > 5 min |
| Revert field usage | - | > 30% (плохая normalization) |

---

## Рекомендации по приоритету

### Немедленно (до MVP)

1. **Уменьшить required поля** — citizenships, cityName сделать optional
2. **Добавить inference в extraction** — страна из города, industry из role
3. **Группировать clarification вопросы** — location, role details

### После MVP

4. **Прогресс-индикатор** — сколько полей заполнено
5. **Skip optional** — явная команда пропустить
6. **Smart defaults** — prefill на основе предыдущих контекстов

### Tech debt

7. **State cleanup** — убирать transient поля после фаз
8. **Разделить normalizations** — display vs logic
9. **Metrics instrumentation** — для мониторинга UX

---

## Заключение

Cold-start граф технически solid, но UX требует значительной работы. Главная проблема — **баланс между полнотой данных и friction для пользователя**.

Текущий подход "спросить всё" работает для power users, но отпугнёт casual users. Рекомендую приоритизировать smart defaults и inference перед запуском.

---

## Приложение: Тестовые сценарии

Проверенные batch-тесты:

| Сценарий | Файл | Покрытие |
|----------|------|----------|
| Clarification flow | `cold-start-clarification-flow.yaml` | 7 шагов, полный путь |
| Normalization | `cold-start-normalization.yaml` | STRICT fields |
| Happy path | `cold-start-happy-path.yaml` | Story → Saved |
| Revert field | `cold-start-revert-field.yaml` | addTerm flow |

Все тесты прошли ✅

---

## Результаты проверки (2025-12-29)

### Проверенные проблемы

| Проблема | Результат | Комментарий |
|----------|-----------|-------------|
| 🔴 P0: Много required полей | ✅ OK | citizenships required by design (visa eligibility) |
| 🔴 P0: Implicit extraction | ✅ Работает | Питер→ru, Москва→ru корректно |
| 🟡 P1: Clarification UX | ✅ Работает | Группирует 3+ missing fields |
| 🟡 P1: Skip optional | ✅ Работает | Optional как hint, не блокируют flow |

### Исправленные баги

1. **Plan hallucination** — LLM выдумывал позиции/курсы при минимальном вводе
   - Fix: `schemas.ts` — убраны примеры из describe, динамическая генерация из CONTEXT_REQUIRED_FIELDS
   - Fix: `prompts.ts` — убраны конкретные примеры формата

### Новые типы

```typescript
// schemas.ts
export const CONTEXT_REQUIRED_FIELDS = [...] as const satisfies readonly ContextRequiredField[];
export const TRAIL_REQUIRED_FIELDS = [...] as const satisfies readonly TrailRequiredField[];
```

### Изменённые файлы

- `src/shared/schemas.ts` — CONTEXT_REQUIRED_FIELDS, TRAIL_REQUIRED_FIELDS, динамический describe
- `src/facade/langGraph/cold-start-v2/prompts.ts` — убраны конкретные примеры
