# Сессия: Исправление классификации интентов в SearchGraph

**Дата**: 2025-12-24
**Цель**: Найти и исправить баг с неправильной классификацией "хочу стать senior" как PROCEED вместо CLARIFY

---

## Фаза 1: Диагностика проблемы

### Что сделано

1. **Прогнали полный flow adhoc → goal → results**
   - "Я backend разработчик" → confirming_adhoc_context ✅
   - "хочу стать senior" → showing_exploration ❌ (должен быть showing_goal)
   - Причина: intent классифицирован как `proceed` вместо `clarify`

2. **Глубокий анализ архитектуры**
   - Изучили весь путь: ConverseTool → GraphManager → SearchGraph → parse_search_intent
   - Выявили: `parseUserIntent(message)` НЕ получает контекст фазы
   - Проблема в `USER_INTENT_PROMPT`: "expresses a career goal" сидит в PROCEED

3. **Оценка архитектуры графа** (честная, без попытки угодить)
   - Граф НЕ переусложнён (23 ноды для сложного workflow — адекватно)
   - Дублирование МИНИМАЛЬНОЕ (только explore/search похожи)
   - 5 conditional edges — НОРМАЛЬНО
   - Проблема НЕ в архитектуре графа, а в семантике промпта

4. **Ресерч LLM observability tools** (Explore agent)
   - TruLens, LangSmith, Langfuse — сравнение
   - Ключевой инсайт: проблема в fuzzy определениях интентов
   - Best practice: структурные требования + Chain-of-Thought

### Что делать дальше

1. **Передавать контекст диалога в parseUserIntent**
   - Использовать существующий `messages: BaseMessage[]` в state
   - INTERRUPT ноды должны добавлять `AIMessage` с вопросом бота
   - `parseUserIntent(message, messages)` — LLM видит что бот спросил

2. **Переписать USER_INTENT_PROMPT**
   - Убрать триггерные слова
   - Семантические инструкции: анализировать СМЫСЛ всего сообщения
   - Не цепляться за одно слово ("давай"), а понимать контекст ("давай проверим")

3. **Применить паттерн ко всем парсерам интентов**
   - `parse_search_intent` — основной
   - `parse_advisor_intent` — аналогично

### Артефакты

- `src/facade/langGraph/search-graph/prompts.ts` — обновлён USER_INTENT_PROMPT (частично)
- `src/facade/langGraph/search-graph/nodes/parse-intent.ts` — добавлено поле `reasoning` в схему
- `src/facade/langGraph/search-graph/nodes/parse-search-intent.ts` — добавлено логирование reasoning

### Частичный успех

После первой правки промпта:
- "хочу стать senior" → `clarify` ✅ (было proceed)
- Reasoning виден в логах: "User said 'хочу стать senior' which contains new goal information"

Но:
- "давай проверим" → `proceed` ❌ (должен быть validate)
- LLM зацепился за "давай" и проигнорировал "проверим"

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Анализировать архитектуру объективно** — не пытаться угодить, давать честную оценку
2. **Глубоко изучать код перед выводами** — 90%+ уверенности
3. **Семантические инструкции в промптах** — не триггерные слова
4. **Использовать существующие поля state** — не дублировать ЗО
5. **Chain-of-Thought для отладки** — добавить `reasoning` поле чтобы видеть логику LLM

### Как делать неправильно

1. **Хардкодить ключевые слова** — "давай", "проверь" — не масштабируется на все языки
2. **Добавлять новые поля без необходимости** — сначала проверить что есть
3. **Сдаваться быстро** — "не все ноды имеют message" → надо разобраться глубже
4. **Править симптом, не причину** — проблема не в графе, а в промпте

### Инсайты

1. **Два уровня intent classification:**
   - Orchestrator (classifyIntent) — какой граф запустить
   - Graph-internal (parseUserIntent) — куда роутить внутри графа

2. **parseUserIntent не имеет контекста** — это корень проблемы:
   - Не знает фазу
   - Не знает что бот спросил
   - Видит только изолированное сообщение

3. **messages[] в state существует, но не используется** — туда надо класть AIMessage (вопросы бота)

4. **Структурные требования > fuzzy описания:**
   - Плохо: "expresses a career goal" (слишком размыто)
   - Хорошо: "provides NEW information that wasn't in conversation"

5. **LLM цепляется за первое совпадение** — если "давай" совпало с PROCEED, он может остановиться

### Наставления от пользователя

1. **"Нужно семантические инструкции без точных примеров"** — мультиязычный ввод, хардкод не работает
2. **"Анализировать всё сообщение целиком, не цепляться за одно слово"** — LLM должен понимать смысл
3. **"Передавать банк сообщений в парсер"** — контекст диалога критичен
4. **"Не дублировать ЗО полей state"** — использовать существующий `messages[]`
5. **"Почему сдался быстро?"** — надо разбираться глубже, не останавливаться на первой проблеме
6. **"Честная оценка архитектуры"** — не пытаться угодить, объективность важнее

---

## Фаза 2: Элегантное решение с phase context

### Что сделано

1. **Передача phase в parseUserIntent** (вместо messages[])
   - Изначально хотели передавать messages[] — но это дублирование логики NLP
   - Элегантное решение: передать `phase` → LLM знает какие опции были предложены
   - `parseUserIntent(message, phase)` + `buildUserIntentPrompt(phase)`

2. **PHASE_CONTEXT map** в `prompts.ts`
   - Каждая фаза объясняет какие опции бот предложил
   - Например: `showing_goal` → "Check with real people, tweak, save"
   - LLM понимает что "давай проверим" = ответ на "check with real people"

3. **Исправлен NLP — нет галлюцинаций**
   - Добавлены инструкции для пустых результатов
   - При `candidates: []` честный ответ + предложение скорректировать фильтры
   - Семантические напутствия, без explicit примеров

4. **appliedFilters передаётся корректно**
   - Все ноды (explore, search, validate_goal) сохраняют params в state
   - NLP видит текущие фильтры и может предложить их скорректировать

5. **Дефолты вынесены в константы**
   - `DEFAULT_CURRENT_SEARCH_PARAMS` — для adhoc/byUser
   - `DEFAULT_TARGET_SEARCH_PARAMS` — для byTarget validation

### Результат тестирования

| Шаг | Сообщение | Intent | Фаза | Статус |
|-----|-----------|--------|------|--------|
| 1 | "Я backend разработчик" | startAdhoc | confirming_adhoc_context | ✅ |
| 2 | "хочу стать senior" | CLARIFY | showing_goal | ✅ |
| 3 | "проверь" | VALIDATE | asking_after_validate | ✅ |
| 4 | "сохрани" | SAVE | showing_results | ✅ |

### Артефакты

- `src/facade/langGraph/search-graph/prompts.ts` — `PHASE_CONTEXT`, `buildUserIntentPrompt()`
- `src/facade/langGraph/search-graph/nodes/parse-intent.ts` — `parseUserIntent(message, phase)`
- `src/facade/langGraph/search-graph/types.ts` — `DEFAULT_*_SEARCH_PARAMS`
- `src/facade/langGraph/search-graph/nodes/explore.ts` — передаёт params в state
- `src/facade/langGraph/search-graph/nodes/search.ts` — передаёт params в state
- `src/facade/langGraph/search-graph/nodes/validate-goal.ts` — передаёт params в state
- `src/facade/services/nlp-formatter/prompts.ts` — инструкции для пустых результатов

---

## Что делать дальше

### Обнаруженная проблема: несогласованность adhoc ↔ goal

В тесте:
- adhoc: "Я backend разработчик" → position: null (грейд не указан)
- goal: "хочу стать senior" → position: senior

**Нелогично:** Цель содержит поле (position), которого нет в adhoc. Пользователь не сказал свой текущий грейд, но хочет стать senior.

**Нужно обсудить:**
1. Как защититься от таких несостыковок?
2. Правило: goal не должен содержать полей, которых нет в adhoc?
3. Или при извлечении goal спрашивать недостающий контекст?

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Анализировать архитектуру объективно** — не пытаться угодить, давать честную оценку
2. **Глубоко изучать код перед выводами** — 90%+ уверенности
3. **Семантические инструкции в промптах** — не триггерные слова, не explicit примеры
4. **Использовать существующие поля state** — не дублировать ЗО
5. **Chain-of-Thought для отладки** — добавить `reasoning` поле чтобы видеть логику LLM
6. **Элегантные решения без дублирования** — phase context вместо hardcoded AIMessage
7. **Дефолты в константы** — `DEFAULT_*_PARAMS` со spread вместо inline объектов

### Как делать неправильно

1. **Хардкодить ключевые слова** — "давай", "проверь" — не масштабируется
2. **Добавлять новые поля без необходимости** — сначала проверить что есть
3. **Сдаваться быстро** — разбираться глубже
4. **Править симптом, не причину** — проблема не в графе, а в промпте
5. **Дублировать логику NLP** — hardcoded AIMessage в ноде = дублирование того что NLP уже делает
6. **Explicit примеры в промптах** — LLM ограничивается примерами, нужна семантика

### Инсайты

1. **Два уровня intent classification:**
   - Orchestrator (classifyIntent) — какой граф запустить
   - Graph-internal (parseUserIntent) — куда роутить внутри графа

2. **Phase = контекст диалога:**
   - Не нужно передавать messages[] — достаточно знать фазу
   - Фаза определяет какие опции были предложены

3. **Структурные требования > fuzzy описания:**
   - Плохо: "expresses a career goal" (слишком размыто)
   - Хорошо: "provides NEW information that wasn't in conversation"

4. **Дефолты должны быть явными:**
   - `DEFAULT_CURRENT_SEARCH_PARAMS` — понятно что это дефолт
   - Inline `{ excludedContextFields: [] }` — непонятно

5. **appliedFilters = обратная связь для пользователя:**
   - Показать с какими фильтрами был поиск
   - Предложить их скорректировать при пустых результатах

### Наставления от пользователя

1. **"Семантические инструкции без точных примеров"** — мультиязычный ввод, хардкод не работает
2. **"Анализировать всё сообщение целиком"** — LLM должен понимать смысл
3. **"Не дублировать ЗО"** — hardcoded AIMessage = дублирование NLP логики
4. **"Честная оценка архитектуры"** — не пытаться угодить, объективность важнее
5. **"Дефолты в константы"** — inline объекты неочевидны
6. **"Улучшить UX при пустых результатах"** — показать фильтры, предложить корректировку
7. **"Несогласованность adhoc ↔ goal"** — нужно защититься от этого

---

## Фаза 3: Прозрачность данных + Kaggle диагностика

### Что сделано

1. **Core fix: goal.set возвращает Goal**
   - Было: `goal.set.mutate()` возвращал `{ goalId }` — storedGoal оставался null
   - Стало: возвращает полный `Goal` — storedGoal корректно заполняется
   - Файлы: `goals.ts`, `goals-manager.ts`, `goal.router.ts`, `set-goal.ts`

2. **Schema updates: adhocContext в response**
   - Добавлен `adhocContext` в: `showing_exploration`, `asking_after_validate`, `showing_results`
   - Добавлен `extractedGoal` в `asking_after_validate`
   - NLP видит полный контекст поиска

3. **NLP прозрачность: показывает missing fields**
   - `confirming_adhoc_context`: "we're missing position, location, industry"
   - `showing_goal`: "we're missing role, domain, skills"
   - `asking_after_validate`: "you're aiming for senior backend developer"
   - Пользователь понимает почему такие результаты и что добавить

4. **Kaggle data issue обнаружена**
   - Position ноды содержат сырые названия ("Sr. Database Administrator")
   - Должны быть нормализованные ("senior", "middle", "junior")
   - Skills case-sensitive ("TypeScript" vs "typescript")
   - Поиск по position возвращает 0 результатов

5. **Создана FEAT-042: Kaggle Import Normalization**
   - P0 приоритет
   - Добавлена в MVP-RELEASE-PLAN.md
   - Фаза 6 помечена как требующая fix

### Результат тестирования

| Сценарий | Результат |
|----------|-----------|
| Explore без position | ✅ Возвращает кандидатов |
| byTarget с position: senior | ❌ 0 результатов (Kaggle data issue) |
| storedGoal после save | ✅ Не null |
| NLP показывает missing fields | ✅ Работает |

### Артефакты

- `src/cypher/queries/goals.ts` — RETURN g {...} вместо userId
- `src/core/goals-manager.ts` — setGoal(): Promise<Goal>
- `src/core/routers/goal.router.ts` — .output(goalSchema)
- `src/facade/langGraph/search-graph/nodes/set-goal.ts` — использует результат mutate
- `src/shared/schemas.ts` — adhocContext в response schemas
- `src/facade/services/nlp-formatter/prompts.ts` — прозрачность missing fields
- `tasks/features/FEAT-042-kaggle-import-normalization.md` — новая задача
- `docs/mvp_final/MVP-RELEASE-PLAN.md` — добавлена FEAT-042

---

## Фаза 4: Тестирование flows + исправление багов

### Что сделано

1. **Тестирование всех flows без position**
   - Advisor Q&A ✅ — отвечает на вопросы, на языке пользователя
   - Filters ✅ — limit, exclude работают
   - Cancel ✅ — "стоп" корректно завершает flow
   - Edge cases ✅ — gibberish и смена темы не ломают flow

2. **Найдено и исправлено 4 бага**

| # | Баг | Причина | Fix |
|---|-----|---------|-----|
| BUG-1 | Advisor "спасибо" → cancel всего flow | `routeAfterAdvisor`: done → cancel | done → show_results |
| BUG-2 | CHANGE "на DevOps" → старая цель | change → load_existing_goal + userResponse очищался | change → extract_goal + shouldKeepUserResponse |
| BUG-3 | DELETE из showing_goal → set_goal | Нет маппинга delete в showing_goal | delete → delete_goal |
| BUG-4 | position: "/null" строка | LLM возвращает "/null" | `removeNullishFields` фильтрует |

3. **UX решения приняты:**
   - `change` = полная замена цели (extract_goal), не редактирование
   - `clarify` = дополнение существующей цели (load_existing_goal → clarify_goal)
   - `delete` везде → delete_goal (удаление сохранённой цели)

4. **FEAT-042 выполнена в параллельной сессии** (commit 06edae7)
   - Kaggle данные нормализованы
   - Position: "Sr." → "senior", "Jr." → "junior"
   - Skills: lowercase
   - creationReason вычисляется из дат

5. **Заведена FEAT-043: SearchGraph Router Consolidation**
   - Убрать дублирование destinations + intent→node
   - Одна структура данных вместо двух

### Артефакты

- `src/facade/langGraph/search-graph/search-router.ts`:
  - `routeAfterAdvisor`: done → show_results
  - `ADVISOR_ROUTE_MAP`: cancel → show_results
  - `showing_results`: change → extract_goal
  - `showing_goal`: добавлен delete → delete_goal
- `src/facade/langGraph/search-graph/nodes/parse-search-intent.ts`:
  - `shouldKeepUserResponse` включает `change`

---

## Фаза 5: Token Limit + Progressive Disclosure Design

### Что сделано

1. **Тестирование с нормализованными Kaggle данными**
   - byTarget search на "senior backend" вернул 20+ кандидатов
   - Token limit exceeded: 163K tokens при лимите 128K
   - NLP не может обработать столько данных

2. **FEAT-043 отложена (DEFERRED → P2)**
   - Анализ показал: дублирование минимальное (~20 LOC)
   - Архитектура графа адекватна (23 ноды для сложного workflow)
   - Safety net полезен — две структуры ловят ошибки

3. **Спроектирован Progressive Disclosure pattern**
   - Если candidates > 10 → показать facets (распределение по полям)
   - Если candidates <= 10 → полный анализ + Chart

4. **Заведены FEAT-044 и FEAT-045**
   - **FEAT-044** (P0): Validation UX — Facets + Token Limit Handling (Facade)
   - **FEAT-045** (P1): Candidates-Only Chart Mode (Chart + Telegram)

5. **Согласованы схемы для параллельной работы**

   ```typescript
   // Facets
   type FacetValue = { value: string; count: number };
   type CandidateFacets = {
     totalCount: number;
     countries: FacetValue[];
     positions: FacetValue[];
     roles: FacetValue[];
     industries: FacetValue[];
   };

   // Chart input (candidates-only mode)
   type GenerateChartInput = {
     userTrajectory: UserContext[];    // [] для candidates-only
     adhocContext?: UserContext;       // ← маркер "Я сейчас здесь"
     candidates: ScoredMatchedCandidate[];
     goalValues?: GoalValues;          // goal line
     // ...existing fields
   };
   ```

### Артефакты

- `tasks/features/FEAT-043-search-router-consolidation.md` — обновлён (DEFERRED + обоснование)
- `tasks/features/FEAT-044-validation-ux-facets.md` — создан
- `tasks/features/FEAT-045-candidates-only-chart.md` — создан
- `docs/mvp_final/MVP-RELEASE-PLAN.md` — добавлены FEAT-044, FEAT-045

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Анализировать архитектуру объективно** — не пытаться угодить, давать честную оценку
2. **Глубоко изучать код перед выводами** — 90%+ уверенности
3. **Семантические инструкции в промптах** — не триггерные слова, не explicit примеры
4. **Элегантные решения без дублирования** — phase context вместо hardcoded AIMessage
5. **Фиксить в правильном слое** — Core если API неполный, не workaround в Facade
6. **Проверять данные при проблемах поиска** — схема vs реальные данные
7. **Думать как пользователь** — абстрагироваться от кода, понять UX ожидания
8. **Трейсить с логами** — reasoning в intent classification показывает логику LLM
9. **Progressive disclosure** — слишком много данных? показать сводку + фильтры
10. **Разделять задачи для параллельной работы** — согласовать схемы, работать независимо

### Как делать неправильно

1. **Хардкодить ключевые слова** — не масштабируется на все языки
2. **Править симптом, не причину** — проблема в данных, не в коде поиска
3. **Дублировать логику** — если дублирование минимально и полезно — оставить
4. **Игнорировать userResponse** — если intent требует данные, сохранять userResponse
5. **Пытаться показать всё** — 20 траекторий текстом нечитаемо, лучше сводка
6. **Refactoring ради refactoring** — если архитектура адекватна, не трогать

### Инсайты

1. **Phase = контекст диалога** — фаза определяет какие опции были предложены
2. **Прозрачность = лучший UX** — показать что использовали для поиска
3. **change ≠ clarify семантически:**
   - change = "хочу другую цель" → extract_goal (с нуля)
   - clarify = "добавь Python" → clarify_goal (мержить)
4. **shouldKeepUserResponse критичен** — если ноде нужны данные из сообщения, userResponse нельзя очищать
5. **Advisor done ≠ cancel** — "спасибо" = закончил Q&A, не отменил flow
6. **Token limit = UX проблема** — graceful degradation лучше чем "Tool execution failed"
7. **Facets с counts** — показать распределение помогает выбрать фильтр
8. **Chart > 1000 слов** — визуализация траекторий информативнее текста
9. **adhocContext маркер в Chart** — точка "где я" + goal line "куда хочу"
10. **Параллельные сессии** — согласовать схемы → работать независимо

### Наставления от пользователя

1. **"Как логично поступить, абстрагируясь от flow?"** — сначала понять UX, потом реализовывать
2. **"Что ожидает пользователь?"** — ключевой вопрос перед любым UX решением
3. **"FEAT-042 сделан в параллельной сессии"** — можно работать над несколькими задачами параллельно
4. **"Бессмысленно показывать много кандидатов"** — даже графики будут неинформативны
5. **"Показать counts по полям"** — пользователь видит распределение, может выбрать фильтр
6. **"Согласуй схемы для параллельной работы"** — контракт между Facade и Chart

---

## Полезные ссылки

- **LangSmith project**: waymates-manual-test (трейсы с reasoning)
- **Voiceflow research**: структурные определения интентов лучше fuzzy
- **FEAT-042**: tasks/features/FEAT-042-kaggle-import-normalization.md (✅ DONE)
- **FEAT-043**: tasks/features/FEAT-043-search-router-consolidation.md (⏸️ DEFERRED)
- **FEAT-044**: tasks/features/FEAT-044-validation-ux-facets.md (⏳ TODO)
- **FEAT-045**: tasks/features/FEAT-045-candidates-only-chart.md (⏳ TODO)

---

## Что делать дальше

### FEAT-044: Validation UX — Facets (P0) — эта сессия
- `computeFacets()` — подсчёт уникальных значений с counts
- Threshold логика в response-builder
- NLP prompt для facets
- Schema updates

### FEAT-045: Candidates-Only Chart (P1) — параллельная сессия
- adhocContext маркер в Chart
- Skip DTW если нет userTrajectory
- Chart generation в validate-goal

---

## Промпт для продолжения после rewind

```
/manual-test-debug sessions/2025-12-24-intent-classification-fix.md

Продолжаем сессию. Прочитай sessions/2025-12-24-intent-classification-fix.md — там Фазы 1-5.

Статус:
✅ Intent classification с phase context — работает
✅ NLP без галлюцинаций + прозрачность — работает
✅ BUG-1..4 исправлены (Advisor, Change, Delete, /null)
✅ FEAT-042 Kaggle Normalization — DONE
✅ FEAT-043 Router Consolidation — DEFERRED (P2, архитектура адекватна)
✅ FEAT-044/045 схемы согласованы

Следующее:
→ FEAT-044: Validation UX — Facets (computeFacets, threshold logic, NLP prompt)
→ Параллельно: FEAT-045 (Chart candidates-only mode)
```
