# LLM Testing Rules

Правила интеграционных тестов с LLM в LangGraph.

---

## 1. Явные фразы

| ❌ | ✅ |
|---|---|
| "проверить" | "покажи кто достиг такой цели" |
| "да" | "сохрани эту цель" |

**Почему:** Общие слова → `unknown` intent.

---

## 2. Даты в фикстурах

Должны быть в пределах `DEFAULT_RECENCY_THRESHOLD_MONTHS` (12 мес).

```json
// ❌ "startDate": "2022-01-01"
// ✅ "startDate": "2025-01-01"
```

---

## 3. State injection — только Turn 1

LangGraph checkpoint перезаписывает state при resume. Helper для state injection работает только на initial invocation.

```typescript
// Turn 1: ✅ state injection works
// Turn 2+: ❌ checkpoint загружает state напрямую
```

---

## 4. Debug логи

Удалять СРАЗУ после диагностики. Не коммитить.
