# Session Log: Prompt Refactoring + Adhoc Context Merge

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Статус:** DONE

---

## Контекст

Продолжение FEAT-046. Рефакторинг промптов по паттерну single source of truth + исправление UX бага с потерей adhoc контекста.

---

## Фаза 1: Type-Safe Refactoring (DONE)

### Что сделано

1. **NODE → z.enum pattern** (как PHASE)
   - Убрали дублирование `key: "key"`
   - `nodeSchema = z.enum([...])`, `NODE = nodeSchema.Values`

2. **Field descriptions для extraction prompts**
   - `ADHOC_FIELD_DESCRIPTIONS: Record<AdhocExtractableField, string>`
   - `GOAL_FIELD_DESCRIPTIONS: Record<GoalExtractableField, string>`
   - Промпты генерируются из map, не hardcoded

### Ключевые файлы
- `src/facade/langGraph/search-graph/state.ts`
- `src/facade/langGraph/search-graph/prompts.ts`

---

## Фаза 2: Adhoc Context Merge (DONE)

### Проблема
При неполном adhoc контексте (не все 4 обязательных поля):
1. Бот просил дополнить
2. Пользователь добавлял недостающее
3. `load_context` извлекал ТОЛЬКО из нового сообщения
4. **Терялись ранее извлечённые поля!**

### Решение (по аналогии с `clarify_goal`)
1. **Новый промпт:** `buildAdhocClarificationPrompt(hints)`
   - Получает текущий контекст JSON
   - LLM мержит: новое перезаписывает, старое сохраняет

2. **Логика в `load_context`:**
   ```
   existing context? → clarifyAdhocContext (merge)
   no context? → extractAdhocContext (from scratch)
   ```

3. **UX в `ask_adhoc_context`:**
   - Показывает "Got: role, domains" + "Missing: position, country"

### Ключевые файлы
- `src/facade/langGraph/search-graph/prompts.ts` — `buildAdhocClarificationPrompt`
- `src/facade/langGraph/search-graph/nodes/load-context.ts` — `clarifyAdhocContext`
- `src/facade/langGraph/search-graph/nodes/ask-adhoc-context.ts` — `buildAskMessage`

---

## Что делать дальше

1. **Протестировать полный flow:** adhoc → goal → search modes → results
2. **Проверить edge cases:** смена контекста полностью ("нет, я frontend")
3. **NLP стиль:** убедиться что Got/Missing сообщения форматируются дружелюбно

---

## Рефлексия

### Паттерн ошибки: Overwrite вместо Merge

| | |
|---|---|
| **Симптом** | Пользователь добавляет инфо, но ранее извлечённое теряется |
| **Первопричина** | `load_context` каждый раз извлекает с нуля, не учитывая `state.adhocContext` |
| **Решение** | Паттерн "LLM merge" — передать текущее состояние в промпт, LLM сама решает что обновить |
| **Аналог в коде** | `clarify_goal` уже делает это — нужно было переиспользовать паттерн |

### Инсайт: LLM merge > Code merge

Для user input лучше доверить merge LLM:
- Понимает семантику ("нет, я frontend" = заменить role)
- Понимает контекст ("добавь Python" = дополнить skills)
- Код-merge слишком примитивен для natural language

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-prompt-refactoring-adhoc-merge.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Type-safe refactoring DONE, adhoc merge DONE
- tsc ✅, lint ✅, facade:rebuild ✅

ЧТО СДЕЛАНО:
- NODE → z.enum (single source of truth)
- ADHOC_FIELD_DESCRIPTIONS, GOAL_FIELD_DESCRIPTIONS
- buildAdhocClarificationPrompt — LLM merge pattern
- ask_adhoc_context показывает Got/Missing

ЧТО ДЕЛАТЬ:
1. Протестировать полный flow: adhoc → goal → search → results
2. Edge cases: полная смена контекста
3. NLP стиль проверить

ПРИНЦИПЫ:
- LLM merge > code merge для user input
- Single source of truth (z.enum)
- Type-safe (Record<EnumType, string>)
```
