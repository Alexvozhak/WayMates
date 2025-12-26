# Session Log: Manual Testing UX + Position Extraction

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Статус:** IN PROGRESS

---

## Контекст

Продолжение FEAT-046. Ручное тестирование полного flow adhoc → goal → search → results. Оценка UX как токсичный пользователь.

---

## Фаза 1: Исправление schema mismatch (DONE)

### Проблема
После rebuild facade, telegram-bot получал ошибку валидации:
```
Invalid discriminator value. Expected 'story_gathering' | ...
```
Facade возвращал `phase: "asking_adhoc_context"`, но поля `missingFields`, `optionalFields` были `undefined`.

### Причина
Старая версия facade в Docker — не была пересобрана после изменений.

### Решение
`npm run facade:rebuild` — после этого всё заработало.

---

## Фаза 2: Полный flow тест (DONE)

### Протестированный сценарий

| # | User | Phase | Результат |
|---|------|-------|-----------|
| 1 | "Я backend разработчик, TypeScript, 5 лет опыта" | asking_adhoc_context | Missing countryCode |
| 2 | "Россия" | confirming_adhoc_context | Context valid |
| 3 | "хочу стать senior" | showing_goal | Goal extracted ✅ |
| 4 | "сохрани" | asking_search_mode | Goal saved ✅ |
| 5 | "проводники" | showing_results | 0 results |

### Что работает
- Intent classification "хочу стать senior" → `clarify` → `extract_goal` ✅
- Adhoc merge (LLM сохраняет ранее извлечённые поля)
- Goal extraction с TargetContext
- Search mode routing "проводники" → `searchPathfinders`

---

## Фаза 3: Position extraction bug (IN PROGRESS)

### Проблема
User: "Я backend разработчик, TypeScript, 5 лет опыта"
LLM extracted: `position: "junior"` (должно быть middle/senior)

### Попытка #1: Добавить experience → position mapping
```typescript
position: "seniority level based on years of experience: 0-2 → junior, 2-5 → middle, 5+ → senior"
```
**Результат:** "5 лет опыта" → `senior` ✅

### Попытка #2: Проверить приоритет explicit > inferred
User: "Я junior backend разработчик, 3 года опыта"
**Ожидание:** `junior` (явное указание)
**Результат:** `middle` (LLM игнорирует explicit, применяет fallback)

### Текущее состояние prompt
```
POSITION FALLBACK (only if user did NOT say junior/middle/senior explicitly):
- Infer from years of experience: 0-2 years = junior, 2-5 years = middle, 5+ years = senior
```

### Следующий шаг
Смотреть LangSmith trace — понять почему LLM игнорирует explicit position.

---

## Найденные UX проблемы

### 1. NLP предлагает деградацию goal
При 0 результатов для goal: senior, бот предлагает "looking at junior roles" — абсурд.

**Статус:** Не исправлено, низкий приоритет.

---

## Ключевые файлы изменены

- `src/facade/langGraph/search-graph/prompts/extraction.ts` — добавлен POSITION FALLBACK

---

## Что делать дальше

1. **LangSmith trace** — понять почему LLM игнорирует explicit "junior"
2. **Возможно:** добавить `reasoning` field в extraction schema (как в intent classification)
3. **После fix position:** проверить edge case "нет, я frontend" (полная смена контекста)
4. **NLP fix:** не предлагать деградацию goal при пустых результатах

---

## Рефлексия

### LLM structured output — нет видимости reasoning

| | |
|---|---|
| **Симптом** | LLM возвращает неожиданный результат, непонятно почему |
| **Первопричина** | Extraction использует `withStructuredOutput` без reasoning field — "чёрный ящик" |
| **Решение** | Добавить optional `reasoning` field в extraction schema (как в intent classification) для отладки |

### Explicit vs Inferred — конфликт в prompt

| | |
|---|---|
| **Симптом** | User говорит "junior", LLM возвращает "middle" |
| **Первопричина** | FALLBACK rule применяется даже когда есть explicit mention — LLM не различает приоритеты |
| **Гипотеза** | Нужно Chain-of-Thought: "Step 1: Is there explicit position? If yes, use it. If no, infer from years." |

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-manual-testing-ux.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Полный flow adhoc → goal → search работает ✅
- Position extraction: fallback по годам работает, но explicit priority НЕ работает

ТЕКУЩАЯ ПРОБЛЕМА:
- "Я junior backend, 3 года опыта" → LLM возвращает "middle", игнорируя explicit "junior"
- Нужно смотреть LangSmith trace чтобы понять reasoning LLM

ЧТО ДЕЛАТЬ:
1. Открыть LangSmith (LANGSMITH_PROJECT=waymates-manual-test)
2. Найти trace extraction запроса
3. Понять почему LLM игнорирует explicit position
4. Либо добавить reasoning field в extraction schema для отладки
```
