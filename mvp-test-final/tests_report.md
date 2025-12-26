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

---

## Таблица багов

| #   | Фаза                     | Критерий               | Проблема                                                                     | Статус |
| --- | ------------------------ | ---------------------- | ---------------------------------------------------------------------------- | ------ |
| 1   | asking_adhoc_context     | Непонятно что отвечать | "What position are you aiming for?" — путает текущий уровень с целью         | FIXED  |
| 2   | showing_goal             | Непонятно что за инфа  | Унаследовал role/domains/skills молча — пользователь не говорил это про цель | FIXED  |
| 3   | showing_results (0)      | Непонятно что не так   | Нет объяснения почему 0 результатов, непонятно что делать                    | FIXED  |
| 4   | asking_search_mode       | Непонятно что отвечать | Jargon (Pathfinders/Waymates), много текста                                  | FIXED  |
| 5   | extraction prompt        | Диалог как с больным   | "джун с 4 годами опыта" → LLM возвращал middle, игнорируя explicit           | FIXED  |
| 6   | confirming_adhoc_context | Переспросы             | Спрашивал seniority хотя position уже заполнен                               | FIXED  |
| 7   | все фазы                 | Диалог как с больным   | "что ты умеешь?" → cancel вместо advisor mode                                | FIXED  |
| 8   | confirming_adhoc_context | Диалог как с больным   | "глянь похожих" → cancel вместо explore (searchWaymates не в valid intents)  | FIXED |

---

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
