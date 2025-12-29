# Отчёт по UX тестированию

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Тестировщик:** Claude (роль токсичного пользователя)

## ВАЖНО! Ты как пользователь не знаешь код и возможности проекта! не мухлюй! Ведя себя так, как будто ты реальный пользователь впервые пробуешь нашу платформу, веди диалог естественно, не делай того, о чем тебе не рассказывали - полагайся только на подсказки в ответах

## Критерии оценки

1. Диалог как с душевно больным
2. Переспросы
3. Дублирование информации, которая выдается пользователю
4. Просьбы уточнить, хотя явно проговорил
5. Непонятно что дальше / что не так
6. Непонятно что за инфа вывелась
7. Непонятно зачем спрашивают
8. Непонятно что отвечать
9. Общее впечатление

## Детали багов

### Баг #1: asking_adhoc_context — "aiming for"

**Отправил:** "Я backend разработчик, TypeScript, Россия"

**Получил:**

```
❌ MISSING: position: Required
What position are you aiming for?
```

**Проблема:** "aiming for" подразумевает ЦЕЛЬ, но нам нужен ТЕКУЩИЙ уровень.

**Fix:** Изменить NLP prompt для asking_adhoc_context — спрашивать про текущий уровень, не про цель.

---

### Баг #2: showing_goal — молчаливое наследование

**Отправил:** "хочу стать senior"

**Получил:**

```
- Position: Senior
- Role: Developer (откуда?)
- Domains: Backend (откуда?)
- Skills: TypeScript (откуда?)
```

**Проблема:** LLM унаследовал поля из adhocContext в goal без объяснения.

**Fix:** Явно сказать что унаследовано: "Based on your profile, keeping backend/Russia. Change?"

---

### Баг #3: showing_results (0) — нет объяснения

**Получил:**

```
Looks like we didn't find any matches...
You could consider adjusting the role or expanding the skills.
```

**Проблема:** Непонятно почему 0, какие фильтры применены, что конкретно убрать.

**Fix:** Показать applied filters + конкретные предложения.

---

### Баг #4: asking_search_mode — jargon

**Получил:**

```
- Pathfinders: people who transitioned...
- Waymates: similar people heading toward...
```

**Проблема:** Много текста, непонятные термины.

**Fix:** Упростить: "Проводники (кто прошёл путь) / Попутчики (идут к той же цели)"

---

### Баг #9: story_gathering — статичное сообщение (cold-start-v2) ✅ FIXED

**Отправил:** "ну короче я бэкендер, 5 лет опыта, питон, сейчас в финтехе работаю"

**Было:**

```
Tell me about your career history.
```

**Стало:**

```
Got it! ... You mentioned you're a backend developer with 5 years of experience in fintech.
Could you share more about any job or position changes?
```

**Решение:** Активное слушание — передаём `messages[]` в NLP formatter, он генерирует acknowledge + follow-up.

**Изменённые файлы:**

- `schemas.ts` — добавили `messages[]` вместо `messageCount`
- `response-builders.ts` — сериализуем messages
- `prompts.ts` — инструкция активного слушания

---

### Баг #10: story_gathering — edit без контекста (cold-start-v2) ✅ FIXED

**Контекст:** На этапе `awaiting_plan_confirmation` пользователь хочет добавить информацию.

**Отправил:** "хочу добавить что раньше был junior"

**Было:**

```
Tell me about your career history.
```

**Стало:** NLP видит всю историю messages и может acknowledge + спросить что добавить. При повторном "готово" LLM merge добавляет новую инфу к существующему плану.

**Решение:** То же что #9 — активное слушание через messages[].

---

### Баг #11: orchestrator — неверная классификация startStory

**Отправил:** "расскажи историю карьеры"

**Получил:** `showing_exploration_candidates` (adhoc search вместо cold-start)

**Проблема:** Intent "расскажи историю карьеры" классифицируется как `getStory` или `startAdhoc` вместо `startStory`.

**Файл:** `src/facade/services/orchestrator/intent-classifier.ts`

**Fix:** Уточнить intent descriptions:

- `startStory`: "wants to TELL their career story, share trajectory, create profile"
- `getStory`: "wants to SEE/VIEW their saved career story"

---

### ~~Баг #12~~: NOT A BUG — citizenships required by design

**Статус:** CLOSED (not a bug)

**Контекст:** citizenships — обязательное поле по бизнес-требованиям (visa/relocation eligibility).

**UX улучшен в коммите `0a6e592`:**
- Clarification показывает `📍 Position 1/2` + почему поле required
- Предлагает OPTIONAL поля (education, salary, languages)
- После MAX_CLARIFICATION_ROUNDS (3) → failed (защита от бесконечного цикла)

---

### Баг #13: plan_career — галлюцинация trails (cold-start-v2) ✅ FIXED

**Отправил:** Полное резюме (4 позиции, без упомянутых курсов/сертификатов)

**Было:**
```
2. Middle Developer at DSSL
   - Incoming Trail: ["Leadership Training Program 2023"]
3. Team Lead at DSSL
   - Incoming Trail: ["Agile Project Management Certification 2024"]
```

**Проблема:** LLM выдумывает trails которых нет в резюме.

**Стало:**
```
incomingTrails: []  (для всех контекстов)
```

**Решение:** Добавлены explicit rules в `planningPrompt`:
- Extract ONLY explicitly mentioned learning activities
- Empty incomingTrails is VALID
- Formal education → educationLevel field, NOT trails

**Изменённые файлы:**
- `prompts.ts` — секция "DO NOT INVENT DATA"

---

### Баг #14: extract_context — creationReason неверные (cold-start-v2)

**Контекст:** CV с 4 позициями: Research Institute → DSSL (Middle) → DSSL (Lead) → Lido

**Получил:**
```
Position 2 (DSSL Middle): creationReason: ["started_working"]  ← должен быть company_changed
Position 3 (DSSL Lead): creationReason: ["company_changed"]  ← неверно, та же компания
Position 4 (Lido): creationReason: ["started_working"]  ← должен быть company_changed
```

**Проблема:** LLM не сравнивает с предыдущим контекстом при определении reason.

**Файл:** `src/facade/langGraph/cold-start-v2/prompts.ts` (contextExtractionPrompt)

**Fix:** Передавать previousContext в промпт для сравнения.

---

### Баг #15: extract_context — position не из словаря (cold-start-v2)

**Получил:**
```
position: "grade-2"
position: "team lead"
position: "project manager"
```

**Проблема:** Значения не из стандартного словаря (junior/middle/senior/lead/principal).

**Ожидаемое:** Нормализация к canonical values.

**Файл:** `contextExtractionPrompt` — проверить dictHints для position

---

### Баг #16: extract_context — skills/domains не нормализованы (cold-start-v2)

**Получил:**
```
skills: ["project management", "team leadership"]
domains: ["research-and-development"]
```

**Проблема:** Значения не из словаря, LLM придумывает свои.

**Файл:** `contextExtractionPrompt` — проверить инжекцию dictHints

---

### Баг #17: orchestrator — "загрузить резюме" не распознаётся ✅ FIXED

**Отправил:** "хочу загрузить своё резюме"

**Было:** `system_message` (unknown intent)

**Стало:** `startStory` → cold-start flow (story_gathering)

**Решение:** Добавлена семантика "upload/share CV/resume" в описание startStory.

**Изменённые файлы:**
- `intent-classifier.ts` — расширено описание startStory

---

## Матрица тестирования

### search-graph

| Коммит | From Phase | Input | Intent | To Phase | Result |
|--------|------------|-------|--------|----------|--------|
| c4a692b | confirming_adhoc (no goal) | "покажи похожих" | explore | showing_exploration_candidates | ✅ |
| c4a692b | confirming_adhoc (no goal) | "хочу стать CTO" | setGoal | showing_goal | ✅ |
| c4a692b | confirming_adhoc (no goal) | "нет, я middle" | editAdhoc | confirming_adhoc | ✅ |
| c4a692b | asking_search_mode | "покажи проводников" | searchPathfinders | showing_results | ✅ |
| c4a692b | showing_goal (profile+goal) | "покажи кто достиг" | validate | asking_after_validate_candidates | ✅ |
| c4a692b | asking_after_validate (profile) | "хочу изменить цель на CTO" | change | showing_goal | ✅ |
| 8d487c7 | confirming_adhoc | "покажи похожих" | explore | showing_exploration_facets | ✅ |
| 8d487c7 | showing_exploration_facets | "хочу стать CTO" | setGoal | showing_goal | ✅ |
| 8d487c7 | showing_exploration_facets | "только technology" | editAdhoc | confirming_adhoc | ✅ |
| 8d487c7 | showing_goal | "покажи кто достиг" | validate | asking_after_validate_candidates | ✅ |
| 8d487c7 | asking_after_validate (0 results) | — | — | honest "no one found" | ✅ |
| 8d487c7 | asking_search_mode | "попутчики" | searchWaymates | showing_results_facets | ✅ |

### cold-start-v2

| Коммит | From Phase | Input | Intent | To Phase | Result |
|--------|------------|-------|--------|----------|--------|
| 9228484 | awaiting_clarification (round 1) | "не хочу говорить" | — | awaiting_clarification (round 2, suggestCancel) | ✅ |
| 9228484 | awaiting_clarification (suggestCancel) | "ок, отменяю" | cancel | cancelled | ✅ |
| 9228484 | awaiting_plan_confirmation | multi-context (2 позиции) | approve | awaiting_context_confirmation (1/2) | ✅ |
| 9228484 | awaiting_context_confirmation (2/2) | "да" | approve | awaiting_final_confirmation | ✅ |

### orchestrator

| Коммит | Input | Expected Intent | Actual Intent | Result |
|--------|-------|-----------------|---------------|--------|
| | | | | |

---
