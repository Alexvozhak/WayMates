# FEAT-039: Раскрытие схемных возможностей пользователю

**Статус:** DONE
**Приоритет:** P1
**Источник:** sessions/2025-12-22-prompt-ux-analysis.md

---

## Проблема

Промпты написаны для LLM ("как извлекать"), а не для пользователя ("что можно указать").
Пользователь не знает о существовании многих полей в схемах.

FEAT-037 и FEAT-038 подготовили инфраструктуру:
- NLP форматирование перенесено в Facade
- Descriptions словарей пробросились

Но сами gaps НЕ закрыты — пользователь по-прежнему не знает о возможностях.

---

## Инвентаризация GAPS

| Агент | Скрытые поля | Зачем нужны |
|-------|--------------|-------------|
| **cold-start-v2** | languages, citizenships, educationLevel, salary, feedback | Международный матчинг, визы, сравнение траекторий |
| **upsert-context** | те же | |
| **update-context** | те же | |
| **search-graph** | desired/undesired mode, excludedReasons, recencyThreshold | Точная фильтрация результатов |
| **upsert-trail** | ratings (1-5), feedback, cost, schedule | Ценность для других пользователей |

---

## Решение

**Подход:** Hints в NlpFormatter (passive)
**Принцип:** Семантические описания (ЧТО + ПОЧЕМУ), не примеры фраз (см. guidelines.md §1.1)

### Изменения в prompts.ts

Добавить секцию "Optional fields" в каждый из 5 промптов.
LLM сама решает когда и как показать hint на основе фазы и контекста.

---

## Hints по графам

### Cold-Start / Upsert-Context / Update-Context

```
Optional fields user might want to share (suggest naturally, don't force):
- languages: B2+ proficiency — helps international job matching
- citizenships: affects visa and work permit eligibility
- educationLevel: relevant for positions requiring degrees
- salary range: helps compare with similar trajectories
- feedback: personal insight on this career transition
```

### Search

```
Advanced search capabilities (mention if user seems interested in refining):
- mode can be "undesired" to EXCLUDE instead of include
- excludedReasons: filter out specific transition types
- recencyThresholdMonths: focus on recent transitions only
```

### Upsert-Trail

```
Optional trail details (user may want to share):
- ratings (1-5): course, platform, schedule quality
- cost: investment amount
- schedule: study intensity
- feedback: personal review of learning experience
```

---

## Файлы для изменения

```
src/facade/services/nlp-formatter/prompts.ts  (~60 LOC)
```

---

## Acceptance Criteria

- [ ] COLD_START_PROMPT содержит hints секцию
- [ ] UPSERT_CONTEXT_PROMPT содержит hints секцию
- [ ] UPDATE_CONTEXT_PROMPT содержит hints секцию
- [ ] SEARCH_PROMPT содержит hints секцию
- [ ] UPSERT_TRAIL_PROMPT содержит hints секцию
- [ ] Нет конкретных примеров фраз (pattern matching trap)
- [ ] lint + tsc проходят
- [ ] Ручная проверка: LLM показывает hints в нужных фазах

---

## LOC Estimate

~60 LOC изменений в одном файле

---

## Зависимости

- FEAT-037 ✅ (NLP в Facade)
- FEAT-038 ✅ (descriptions словарей)
