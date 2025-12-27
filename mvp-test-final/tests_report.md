# Отчёт по UX тестированию

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Тестировщик:** Claude (роль токсичного пользователя)

## ВАЖНО! Ты как пользователь не знаешь код и возможности проекта! не мухлюй! Ведя себя так, как будто ты реальный пользователь впервые пробуешь нашу платформу, веди диалог естественно, не делай того, о чем тебе не рассказывали - полагайся только на подсказки в ответах

## Критерии оценки

1. Диалог как с душевно больным
2. Переспросы
3. Просьбы уточнить, хотя явно проговорил
4. Непонятно что дальше / что не так
5. Непонятно что за инфа вывелась
6. Непонятно зачем спрашивают
7. Непонятно что отвечать
8. Общее впечатление

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

### Баг #12: awaiting_clarification — нельзя пропустить поле (cold-start-v2)

**Контекст:** Бот спрашивает про citizenships.

**Отправил:** "не хочу указывать гражданство"

**Получил:**

```
Please provide your citizenships so we can continue...
```

**Проблема:** Бот игнорирует явный отказ пользователя и продолжает спрашивать обязательное поле.

**Файл:** `src/facade/langGraph/cold-start-v2/nodes/clarify-fields.ts`

**Fix:** Варианты:

1. Добавить "skip" intent в clarification
2. Сделать citizenships optional
3. Использовать default value при отказе

---
